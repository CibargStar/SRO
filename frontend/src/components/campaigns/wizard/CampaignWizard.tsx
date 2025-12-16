import React from 'react';
import { Stepper, Step, StepLabel, Typography, Paper } from '@mui/material';

interface CampaignWizardProps {
  steps: { label: string; description?: string }[];
  activeStep: number;
}

/**
 * Обертка для степпера мастера кампаний.
 */
export function CampaignWizard({ steps, activeStep }: CampaignWizardProps) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((step) => (
          <Step key={step.label}>
            <StepLabel
              optional={
                step.description ? (
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                ) : undefined
              }
            >
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Paper>
  );
}

export default CampaignWizard;





