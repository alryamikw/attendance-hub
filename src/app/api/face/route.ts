import { NextRequest, NextResponse } from 'next/server';
import { faceRecognition } from '@/lib/face-recognition';
import { db } from '@/lib/db';

// POST /api/face/detect - Detect face in image
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, action } = body;
    
    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }
    
    if (action === 'detect') {
      const result = await faceRecognition.detectFace(image);
      return NextResponse.json(result);
    }
    
    if (action === 'embedding') {
      const result = await faceRecognition.generateEmbedding(image);
      return NextResponse.json(result);
    }
    
    if (action === 'liveness') {
      const result = await faceRecognition.checkLiveness(image);
      return NextResponse.json(result);
    }
    
    if (action === 'register') {
      const { employeeId, tenantId } = body;
      
      if (!employeeId || !tenantId) {
        return NextResponse.json(
          { error: 'Employee ID and Tenant ID are required' },
          { status: 400 }
        );
      }
      
      // Detect face first
      const detection = await faceRecognition.detectFace(image);
      if (!detection.detected) {
        return NextResponse.json(
          { error: 'No face detected' },
          { status: 400 }
        );
      }
      
      // Generate embedding
      const { embedding } = await faceRecognition.generateEmbedding(image);
      if (!embedding) {
        return NextResponse.json(
          { error: 'Failed to generate face embedding' },
          { status: 500 }
        );
      }
      
      // Store face profile
      const faceProfile = await db.faceProfile.upsert({
        where: { employeeId },
        create: {
          tenantId,
          employeeId,
          embedding: JSON.stringify(embedding),
          imageUrl: image.substring(0, 100), // Store reference
        },
        update: {
          embedding: JSON.stringify(embedding),
          imageUrl: image.substring(0, 100),
        },
      });
      
      return NextResponse.json({
        success: true,
        faceProfileId: faceProfile.id,
      });
    }
    
    if (action === 'verify') {
      const { employeeId } = body;
      
      if (!employeeId) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }
      
      // Get stored face profile
      const faceProfile = await db.faceProfile.findUnique({
        where: { employeeId },
      });
      
      if (!faceProfile) {
        return NextResponse.json(
          { error: 'No face profile found for this employee' },
          { status: 404 }
        );
      }
      
      const storedEmbedding = JSON.parse(faceProfile.embedding);
      
      // Verify face
      const result = await faceRecognition.verifyFace(
        image,
        storedEmbedding,
        { checkLiveness: true }
      );
      
      return NextResponse.json(result);
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Face API error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
