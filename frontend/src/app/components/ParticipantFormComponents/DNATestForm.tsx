import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { DNATest } from '../../../lib/mock-data';

interface DNATestFormProps {
  test?: DNATest;
  open: boolean;
  onSave: (test: Omit<DNATest, 'id'>) => void;
  onCancel: () => void;
}

const dnaTestSchema = z.object({
  testType: z.enum(['y-DNA', 'atDNA', 'mtDNA']),
  testName: z.string().min(1, 'Test name is required'),
  provider: z.enum(['FTDNA', 'AncestryDNA', '23andMe', 'Other']),
  kitNumber: z.string().min(1, 'Kit number is required'),
  markerCount: z.number().int().positive().optional(),
  registered: z.boolean(),
  gedmatchKit: z.string().optional(),
});

type DNATestFormData = z.infer<typeof dnaTestSchema>;

export function DNATestForm({ test, open, onSave, onCancel }: DNATestFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<DNATestFormData>({
    resolver: zodResolver(dnaTestSchema),
    defaultValues: test || {
      testType: 'y-DNA',
      testName: '',
      provider: 'FTDNA',
      kitNumber: '',
      markerCount: undefined,
      registered: false,
      gedmatchKit: '',
    },
  });

  const testType = watch('testType');

  const onSubmit = (data: DNATestFormData) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{test ? 'Edit DNA Test' : 'Add DNA Test'}</DialogTitle>
          <DialogDescription>
            {test ? 'Update the DNA test information.' : 'Add a new DNA test for this participant.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Test Type */}
          <div>
            <Label>Test Type *</Label>
            <RadioGroup
              value={testType}
              onValueChange={(value) => setValue('testType', value as DNATestFormData['testType'])}
              className="grid-cols-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="y-DNA" id="y-dna" />
                <Label htmlFor="y-dna" className="font-normal cursor-pointer">y-DNA</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="atDNA" id="atdna" />
                <Label htmlFor="atdna" className="font-normal cursor-pointer">atDNA</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mtDNA" id="mtdna" />
                <Label htmlFor="mtdna" className="font-normal cursor-pointer">mtDNA</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Test Name */}
          <div>
            <Label htmlFor="testName">Test Name *</Label>
            <Input
              id="testName"
              placeholder="e.g., Y-DNA111, Family Finder, Big Y"
              {...register('testName')}
            />
            {errors.testName && (
              <p className="text-sm text-red-600 mt-1">{errors.testName.message}</p>
            )}
          </div>

          {/* Provider */}
          <div>
            <Label htmlFor="provider">Provider *</Label>
            <Select
              value={watch('provider')}
              onValueChange={(value) => setValue('provider', value as DNATestFormData['provider'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FTDNA">FamilyTreeDNA</SelectItem>
                <SelectItem value="AncestryDNA">AncestryDNA</SelectItem>
                <SelectItem value="23andMe">23andMe</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Kit Number */}
          <div>
            <Label htmlFor="kitNumber">Kit Number *</Label>
            <Input
              id="kitNumber"
              placeholder="e.g., 967523"
              {...register('kitNumber')}
            />
            {errors.kitNumber && (
              <p className="text-sm text-red-600 mt-1">{errors.kitNumber.message}</p>
            )}
          </div>

          {/* Marker Count (y-DNA only) */}
          {testType === 'y-DNA' && (
            <div>
              <Label htmlFor="markerCount">Marker Count</Label>
              <Input
                id="markerCount"
                type="number"
                placeholder="e.g., 37, 67, 111"
                {...register('markerCount', { valueAsNumber: true })}
              />
              {errors.markerCount && (
                <p className="text-sm text-red-600 mt-1">{errors.markerCount.message}</p>
              )}
            </div>
          )}

          {/* GEDmatch Kit (atDNA only) */}
          {testType === 'atDNA' && (
            <div>
              <Label htmlFor="gedmatchKit">GEDmatch Kit</Label>
              <Input
                id="gedmatchKit"
                placeholder="e.g., A901011"
                {...register('gedmatchKit')}
              />
            </div>
          )}

          {/* Registered with Project */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="registered"
              {...register('registered')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="registered" className="font-normal cursor-pointer">
              Registered with project
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {test ? 'Save Changes' : 'Add Test'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
