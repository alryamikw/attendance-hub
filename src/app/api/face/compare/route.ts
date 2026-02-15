import { NextRequest, NextResponse } from 'next/server';

// Face comparison API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image1, image2 } = body;
    
    if (!image1 || !image2) {
      return NextResponse.json(
        { error: 'Both images are required' },
        { status: 400 }
      );
    }
    
    // Simulated face comparison
    // In production, this would use actual face embedding comparison
    
    const similarity = 0.75 + Math.random() * 0.2;
    const threshold = 0.75;
    
    return NextResponse.json({
      match: similarity >= threshold,
      confidence: similarity,
      similarity,
      message: similarity >= threshold 
        ? 'Faces match successfully' 
        : 'Faces do not match',
    });
  } catch (error) {
    console.error('Face comparison error:', error);
    return NextResponse.json(
      { match: false, confidence: 0, similarity: 0, message: 'Comparison failed' },
      { status: 500 }
    );
  }
}
