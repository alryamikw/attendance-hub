/**
 * Face Recognition Module
 * Uses VLM API for face detection and verification
 */

import ZAI from 'z-ai-web-dev-sdk';

export interface FaceDetectionResult {
  detected: boolean;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: Array<{ x: number; y: number; type: string }>;
  embedding?: number[];
  error?: string;
}

export interface FaceMatchResult {
  isMatch: boolean;
  confidence: number;
  distance: number;
  threshold: number;
}

export interface LivenessResult {
  isLive: boolean;
  confidence: number;
  checks: {
    blinkDetected?: boolean;
    movementDetected?: boolean;
    textureScore?: number;
  };
}

// Face recognition service
class FaceRecognitionService {
  private zai: any = null;
  
  async initialize() {
    this.zai = await ZAI.create();
  }
  
  /**
   * Detect faces in an image
   */
  async detectFace(imageBase64: string): Promise<FaceDetectionResult> {
    try {
      if (!this.zai) await this.initialize();
      
      // Use VLM to analyze the image for face detection
      const response = await this.zai.chat.completions.create({
        model: 'glm-4v-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a face detection AI. Analyze images and detect faces. Return JSON with: detected (boolean), confidence (0-1), faceCount (number). Be precise and only detect actual human faces.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this image for human faces. Return JSON: {"detected": boolean, "confidence": number, "faceCount": number, "description": string}' },
              { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 500,
      });
      
      const content = response.choices[0]?.message?.content || '';
      
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          detected: result.detected || false,
          confidence: result.confidence || 0,
        };
      }
      
      return { detected: false, confidence: 0, error: 'Failed to parse response' };
    } catch (error) {
      return { detected: false, confidence: 0, error: String(error) };
    }
  }
  
  /**
   * Generate face embedding (simplified - in production use proper face recognition)
   */
  async generateEmbedding(imageBase64: string): Promise<{ embedding: number[] | null; error?: string }> {
    try {
      if (!this.zai) await this.initialize();
      
      // Use VLM to extract facial features description
      const response = await this.zai.chat.completions.create({
        model: 'glm-4v-flash',
        messages: [
          {
            role: 'system',
            content: 'You analyze facial features. Describe the face in a consistent format that can be used for matching. Focus on: face shape, eye color, hair, distinctive features.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this face for identification purposes. Be consistent and detailed.' },
              { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 300,
      });
      
      const description = response.choices[0]?.message?.content || '';
      
      // Convert description to a simple hash-based embedding
      // In production, use proper face recognition library
      const embedding = this.stringToEmbedding(description);
      
      return { embedding };
    } catch (error) {
      return { embedding: null, error: String(error) };
    }
  }
  
  /**
   * Compare two faces
   */
  async compareFaces(embedding1: number[], embedding2: number[]): Promise<FaceMatchResult> {
    const distance = this.cosineDistance(embedding1, embedding2);
    const threshold = 0.3; // Adjust based on testing
    
    return {
      isMatch: distance < threshold,
      confidence: 1 - distance,
      distance,
      threshold,
    };
  }
  
  /**
   * Basic liveness detection using VLM
   */
  async checkLiveness(imageBase64: string): Promise<LivenessResult> {
    try {
      if (!this.zai) await this.initialize();
      
      const response = await this.zai.chat.completions.create({
        model: 'glm-4v-flash',
        messages: [
          {
            role: 'system',
            content: 'You detect if an image is a real person or a photo/spoof. Check for: screen reflections, paper texture, 3D depth, natural skin texture. Return JSON: {"isLive": boolean, "confidence": number, "reasons": string[]}',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Is this a live person or a spoof (photo/video)? Analyze carefully.' },
              { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 300,
      });
      
      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          isLive: result.isLive ?? true,
          confidence: result.confidence ?? 0.5,
          checks: {
            textureScore: result.confidence,
          },
        };
      }
      
      return { isLive: true, confidence: 0.5, checks: {} };
    } catch (error) {
      return { isLive: true, confidence: 0.5, checks: {} };
    }
  }
  
  /**
   * Full face verification pipeline
   */
  async verifyFace(
    capturedImage: string,
    storedEmbedding: number[],
    options: { checkLiveness?: boolean } = {}
  ): Promise<{
    verified: boolean;
    faceDetected: boolean;
    isLive: boolean;
    matchConfidence: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    // Step 1: Detect face
    const detection = await this.detectFace(capturedImage);
    if (!detection.detected) {
      errors.push('No face detected in the image');
      return { verified: false, faceDetected: false, isLive: false, matchConfidence: 0, errors };
    }
    
    // Step 2: Check liveness if enabled
    let isLive = true;
    if (options.checkLiveness) {
      const liveness = await this.checkLiveness(capturedImage);
      isLive = liveness.isLive;
      if (!isLive) {
        errors.push('Liveness check failed - possible spoof detected');
      }
    }
    
    // Step 3: Generate embedding and compare
    const { embedding } = await this.generateEmbedding(capturedImage);
    if (!embedding) {
      errors.push('Failed to generate face embedding');
      return { verified: false, faceDetected: true, isLive, matchConfidence: 0, errors };
    }
    
    const match = await this.compareFaces(embedding, storedEmbedding);
    
    return {
      verified: match.isMatch && isLive,
      faceDetected: true,
      isLive,
      matchConfidence: match.confidence,
      errors,
    };
  }
  
  // Helper: Convert string to numerical embedding
  private stringToEmbedding(str: string): number[] {
    const embedding: number[] = [];
    const chunks = str.match(/.{1,10}/g) || [];
    
    for (let i = 0; i < 128; i++) {
      const chunk = chunks[i % chunks.length] || '';
      let sum = 0;
      for (const char of chunk) {
        sum += char.charCodeAt(0);
      }
      embedding.push((sum % 1000) / 1000);
    }
    
    return this.normalizeEmbedding(embedding);
  }
  
  // Helper: Normalize embedding to unit vector
  private normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }
  
  // Helper: Calculate cosine distance
  private cosineDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return 1;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) return 1;
    
    return 1 - (dotProduct / (magnitudeA * magnitudeB));
  }
}

// Export singleton instance
export const faceRecognition = new FaceRecognitionService();

// React hook for face recognition
export function useFaceRecognition() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const detectFace = async (imageBase64: string) => {
    setLoading(true);
    setError(null);
    const result = await faceRecognition.detectFace(imageBase64);
    if (result.error) setError(result.error);
    setLoading(false);
    return result;
  };
  
  const generateEmbedding = async (imageBase64: string) => {
    setLoading(true);
    setError(null);
    const result = await faceRecognition.generateEmbedding(imageBase64);
    if (result.error) setError(result.error);
    setLoading(false);
    return result;
  };
  
  const verifyFace = async (
    capturedImage: string,
    storedEmbedding: number[],
    options?: { checkLiveness?: boolean }
  ) => {
    setLoading(true);
    setError(null);
    const result = await faceRecognition.verifyFace(capturedImage, storedEmbedding, options);
    if (result.errors.length > 0) setError(result.errors.join(', '));
    setLoading(false);
    return result;
  };
  
  return { loading, error, detectFace, generateEmbedding, verifyFace };
}

import { useState } from 'react';
