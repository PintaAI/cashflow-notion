import { google } from '@ai-sdk/google';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCategories } from '@/app/actions/categories';
import { auth } from '@/lib/auth';
import { validateImageUpload } from '@/app/api/extract-image-validation';

const receiptSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe('A brief description of what the expense/income is about (e.g., "Lunch at restaurant", "Salary", "Grocery shopping")'),
  amount: z
    .number()
    .nullable()
    .describe('The monetary amount as a number only (no currency symbols, just the numeric value)'),
  date: z
    .string()
    .date()
    .nullable()
    .describe('Date in YYYY-MM-DD format (e.g., "2024-01-15")'),
  category: z
    .string()
    .nullable()
    .describe('The most appropriate category for this expense. Choose from the available categories or use "Lainnya" if unsure.'),
  io: z
    .enum(['Income', 'Expenses'])
    .nullable()
    .describe('Either "Income" for money received or "Expenses" for money spent'),
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

    const uploadError = validateImageUpload(image);
    if (uploadError) return uploadError;
    const imageFile = image as File;

    const categories = await fetchCategories();
    const categoryDescription = `Available categories: ${categories.join(', ')}. Use "Lainnya" if the expense does not fit any category.`;

    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const result = await generateText({
      model: google('gemini-2.5-flash-lite'),
      temperature: 0,
      output: Output.object({
        name: 'ReceiptData',
        description: 'Extracted information from a receipt or financial document',
        schema: receiptSchema,
      }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all relevant information from this receipt/image. Look for: the item/service name or description, the total amount paid or received, the date of transaction, and determine the most appropriate category and whether this is income or an expense.\n\n${categoryDescription}`,
            },
            {
              type: 'image',
              image: `data:${imageFile.type};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    if (result.output.category && !categories.includes(result.output.category)) {
      result.output.category = 'Lainnya';
    }

    return NextResponse.json({
      success: true,
      data: result.output,
    });
  } catch (error) {
    console.error('Extract receipt error:', error);
    
    if (NoObjectGeneratedError.isInstance(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to extract valid data from the image',
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
