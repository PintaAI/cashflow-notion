import { google } from '@ai-sdk/google';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema matching the expense form fields
// Using .nullable() for optional fields (best practice for strict schema validation)
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
    .enum([
      'sosial',
      'keluarga',
      'clothing',
      'skincare',
      'tidak terduga',
      'Jajan',
      'Transportasi',
      'Belanja',
      'Tagihan',
      'Hiburan',
      'Kesehatan',
      'Lainnya',
    ])
    .nullable()
    .describe('The most appropriate category for this expense. Choose from: sosial (social activities), keluarga (family), clothing (clothes), skincare (beauty products), tidak terduga (unexpected), Jajan (snacks/food), Transportasi (transportation), Belanja (shopping), Tagihan (bills), Hiburan (entertainment), Kesehatan (health), Lainnya (other). Use "Lainnya" if unsure.'),
  io: z
    .enum(['Income', 'Expenses'])
    .nullable()
    .describe('Either "Income" for money received or "Expenses" for money spent'),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const imageBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const result = await generateText({
      model: google('gemini-2.5-flash-lite'),
      // Use temperature: 0 for deterministic, consistent results (best practice for structured outputs)
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
              text: 'Extract all relevant information from this receipt/image. Look for: the item/service name or description, the total amount paid or received, the date of transaction, and determine the most appropriate category and whether this is income or an expense.',
            },
            {
              type: 'image',
              image: `data:${image.type || 'image/jpeg'};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      success: true,
      data: result.output,
    });
  } catch (error) {
    console.error('Extract receipt error:', error);
    
    // Handle structured output specific errors
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