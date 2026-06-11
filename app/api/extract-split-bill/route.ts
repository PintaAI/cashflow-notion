import { google } from '@ai-sdk/google';
import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { validateImageUpload } from '@/app/api/extract-image-validation';

const splitBillSchema = z.object({
  place: z
    .string()
    .nullable()
    .describe('The merchant, restaurant, cafe, or place name if visible on the receipt.'),
  total: z
    .number()
    .nullable()
    .describe('The final total paid on the receipt as a number only, without currency symbols.'),
  items: z
    .array(
      z.object({
        name: z
          .string()
          .describe('The item name as shown on the receipt. Use a concise readable name.'),
        amount: z
          .number()
          .describe('The final item price as a number only, without currency symbols.'),
      })
    )
    .describe('Line items from the receipt. Prefer itemized rows over summary totals.'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const currency = String(formData.get('currency') || 'IDR');

    const uploadError = validateImageUpload(image);
    if (uploadError) return uploadError;
    const imageFile = image as File;

    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const result = await generateText({
      model: google('gemini-2.5-flash-lite'),
      temperature: 0,
      output: Output.object({
        name: 'SplitBillReceiptData',
        description: 'Itemized receipt data for a split bill calculator',
        schema: splitBillSchema,
      }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract itemized bill data from this receipt image for a split bill calculator. The selected currency is ${currency}.

Return the place name when visible, the final total when visible, and each purchasable line item with its final price.

Important amount parsing rules:
- Return numeric amounts in the selected currency's smallest displayed unit, without currency symbols.
- If currency is IDR, Indonesian receipts commonly use dot or comma as thousand separators. Examples: "13.000", "13,000", or "13 000" must be returned as 13000, not 13. "1.250.000" must be returned as 1250000.
- For IDR, short menu prices like "13" or "13.0" on receipts usually mean 13000 when the receipt total and other rows use thousand-scale pricing. Infer the full rupiah amount from the receipt context.
- Do not convert currency.

Ignore tax, service charge, discounts, payment method, cashier info, order number, and change unless there are no item rows. If item rows are not readable but a final total is visible, return one item named "Total struk" with the total amount.`,
            },
            {
              type: 'image',
              image: `data:${imageFile.type};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    const items = result.output.items.filter((item) => item.name.trim() && item.amount > 0);

    return NextResponse.json({
      success: true,
      data: {
        ...result.output,
        items,
      },
    });
  } catch (error) {
    console.error('Extract split bill error:', error);

    if (NoObjectGeneratedError.isInstance(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to extract valid split bill data from the image',
          details: {
            cause: error.cause,
            text: error.text,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
