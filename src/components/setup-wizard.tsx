'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, User, Lock, Globe, CheckCircle2, 
  ArrowRight, ArrowLeft, Loader2, Sparkles 
} from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

const steps = [
  { id: 1, title: 'Company Details', icon: Building2 },
  { id: 2, title: 'Admin Account', icon: User },
  { id: 3, title: 'Settings', icon: Globe },
  { id: 4, title: 'Complete', icon: CheckCircle2 },
];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    companyName: '',
    companySlug: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    timezone: 'UTC',
    currency: 'USD',
  });
  
  const updateForm = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };
  
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };
  
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.companyName.trim()) {
          setError('Company name is required');
          return false;
        }
        if (!formData.companySlug.trim()) {
          setError('Company slug is required');
          return false;
        }
        if (!/^[a-z0-9-]+$/.test(formData.companySlug)) {
          setError('Slug can only contain lowercase letters, numbers, and hyphens');
          return false;
        }
        return true;
      case 2:
        if (!formData.adminName.trim()) {
          setError('Admin name is required');
          return false;
        }
        if (!formData.adminEmail.trim()) {
          setError('Admin email is required');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
          setError('Invalid email format');
          return false;
        }
        if (formData.adminPassword.length < 8) {
          setError('Password must be at least 8 characters');
          return false;
        }
        if (formData.adminPassword !== formData.confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        return true;
      case 3:
        return true;
      default:
        return true;
    }
  };
  
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };
  
  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  
  const completeSetup = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentStep(4);
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setError(data.error || 'Setup failed');
        setLoading(false);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };
  
  const progress = ((currentStep - 1) / 3) * 100;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Welcome to AttendanceHub</CardTitle>
          <CardDescription>Let's set up your attendance system in a few steps</CardDescription>
          
          {/* Progress */}
          <div className="mt-6">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-4">
              {steps.map((step) => (
                <div 
                  key={step.id} 
                  className={`flex flex-col items-center ${currentStep >= step.id ? 'text-emerald-600' : 'text-muted-foreground'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    currentStep >= step.id 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-slate-200'
                  }`}>
                    {currentStep > step.id ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-xs mt-1 hidden sm:block">{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {/* Step 1: Company Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="TechCorp Solutions"
                  value={formData.companyName}
                  onChange={(e) => {
                    updateForm('companyName', e.target.value);
                    if (!formData.companySlug || formData.companySlug === generateSlug(formData.companyName)) {
                      updateForm('companySlug', generateSlug(e.target.value));
                    }
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="companySlug">Company Slug *</Label>
                <Input
                  id="companySlug"
                  placeholder="techcorp-solutions"
                  value={formData.companySlug}
                  onChange={(e) => updateForm('companySlug', e.target.value.toLowerCase())}
                />
                <p className="text-xs text-muted-foreground">
                  Used in URLs and identifiers. Only lowercase letters, numbers, and hyphens.
                </p>
              </div>
            </div>
          )}
          
          {/* Step 2: Admin Account */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminName">Administrator Name *</Label>
                <Input
                  id="adminName"
                  placeholder="John Doe"
                  value={formData.adminName}
                  onChange={(e) => updateForm('adminName', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Email Address *</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@company.com"
                  value={formData.adminEmail}
                  onChange={(e) => updateForm('adminEmail', e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Password *</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.adminPassword}
                    onChange={(e) => updateForm('adminPassword', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => updateForm('confirmPassword', e.target.value)}
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters.
              </p>
            </div>
          )}
          
          {/* Step 3: Settings */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    className="w-full h-10 px-3 border rounded-md"
                    value={formData.timezone}
                    onChange={(e) => updateForm('timezone', e.target.value)}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    className="w-full h-10 px-3 border rounded-md"
                    value={formData.currency}
                    onChange={(e) => updateForm('currency', e.target.value)}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="SAR">SAR (﷼)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <h4 className="font-medium mb-2">Default Settings Applied:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Working days: Monday - Friday</li>
                  <li>✓ Working hours: 09:00 - 18:00</li>
                  <li>✓ Grace period: 15 minutes</li>
                  <li>✓ Overtime rate: 1.5x</li>
                  <li>✓ Annual leave: 21 days</li>
                  <li>✓ Sick leave: 10 days</li>
                </ul>
              </div>
            </div>
          )}
          
          {/* Step 4: Complete */}
          {currentStep === 4 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Setup Complete!</h3>
              <p className="text-muted-foreground">
                Your attendance system is ready. Redirecting to dashboard...
              </p>
              {loading && (
                <div className="mt-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                </div>
              )}
            </div>
          )}
          
          {/* Navigation Buttons */}
          {currentStep < 4 && (
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              {currentStep === 3 ? (
                <Button
                  onClick={completeSetup}
                  disabled={loading}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
