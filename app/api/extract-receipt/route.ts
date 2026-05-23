import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

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

    const { text } = await generateText({
      model: google('gemini-2.5-flash-lite'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the amount and date from this receipt/image. Return the result as JSON with "amount" (number) and "date" (YYYY-MM-DD format) fields. If you cannot find a value, set it to null. Only return the JSON, no other text.',
            },
            {
              type: 'image',
              image: `data:${image.type || 'image/jpeg'};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    // Parse the response (handle markdown code blocks)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    return NextResponse.json({
      success: true,
      data: {
        amount: parsed.amount,
        date: parsed.date,
      },
    });
  } catch (error) {
    console.error('Extract receipt error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}