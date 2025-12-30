/**
 * CreateCampaignPage.tsx
 * 
 * Страница создания новой кампании с пошаговым мастером
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { StyledButton, LOADING_ICON_SIZE } from '@/components/common';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTemplates } from '@/hooks/useTemplates';
import { useCreateCampaign } from '@/hooks/useCampaigns';
import { useClientGroups } from '@/hooks/useClientGroups';
import { ClientGroupSelector } from '@/components/ClientGroupSelector';
import type {
  CreateCampaignInput,
  CampaignType,
  MessengerTarget,
  UniversalTarget,
  ScheduleConfig,
  FilterConfig,
  OptionsConfig,
} from '@/types/campaign';
import type { Template } from '@/types/template';
import { WizardStep1_BasicInfo, WizardStep2_SelectTemplate, WizardStep3_SelectBase, WizardStep4_SelectProfiles, WizardStep5_Schedule, WizardStep6_Options, WizardStep7_Review } from '@/components/campaigns';
import { createCampaignSchema } from '@/schemas/campaign.schema';

// Шаги мастера
const WIZARD_STEPS = [
  { label: 'Основное', description: 'Название и тип' },
  { label: 'Шаблон', description: 'Выберите шаблон' },
  { label: 'База', description: 'Группа клиентов' },
  { label: 'Профили', description: 'Выберите профили' },
  { label: 'Расписание', description: 'Рабочие часы и дни' },
  { label: 'Опции', description: 'Дедупликация, паузы' },
  { label: 'Обзор', description: 'Проверка данных' },
];

interface CampaignFormData {
  name: string;
  description: string;
  campaignType: CampaignType;
  messengerType: MessengerTarget;
  universalTarget: UniversalTarget | null;
  templateId: string;
  clientGroupId: string;
  profileIds: string[];
  scheduledAt: string | null;
  scheduleConfig?: ScheduleConfig;
  filterConfig?: FilterConfig;
  optionsConfig?: OptionsConfig;
}

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  // Запросы данных
  const { data: templatesData, isLoading: templatesLoading } = useTemplates({ limit: 100 });
  const { data: clientGroupsData, isLoading: groupsLoading } = useClientGroups();

  // Mutation
  const createMutation = useCreateCampaign();

  // Form
  const formMethods = useForm<CampaignFormData>({
    resolver: zodResolver(createCampaignSchema.omit({ profileIds: true }).extend({
      profileIds: createCampaignSchema.shape.profileIds.optional(),
    })),
    defaultValues: {
      name: '',
      description: '',
      campaignType: 'ONE_TIME',
      messengerType: 'WHATSAPP_ONLY',
      universalTarget: null,
      templateId: '',
      clientGroupId: '',
      profileIds: [],
      scheduledAt: null,
      scheduleConfig: {
        workHoursEnabled: false,
        workDaysEnabled: false,
        workDays: [],
        recurrence: 'NONE',
        timezone: 'Europe/Moscow',
      },
    },
    mode: 'onChange',
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isValid },
  } = formMethods;

  const watchedValues = watch();

  // Фильтрованные шаблоны по типу мессенджера
  const filteredTemplates = useMemo(() => {
    if (!templatesData?.data) return [];
    const messengerType = watchedValues.messengerType;
    
    return templatesData.data.filter(template => {
      if (messengerType === 'UNIVERSAL') return true;
      if (messengerType === 'WHATSAPP_ONLY') {
        return template.messengerTarget === 'WHATSAPP_ONLY' || template.messengerTarget === 'UNIVERSAL';
      }
      if (messengerType === 'TELEGRAM_ONLY') {
        return template.messengerTarget === 'TELEGRAM_ONLY' || template.messengerTarget === 'UNIVERSAL';
      }
      return true;
    });
  }, [templatesData?.data, watchedValues.messengerType]);

  // Handlers
  const handleBack = () => {
    if (activeStep === 0) {
      navigate('/campaigns');
    } else {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleNext = async () => {
    // Валидация текущего шага
    let fieldsToValidate: (keyof CampaignFormData)[] = [];
    
    switch (activeStep) {
      case 0:
        fieldsToValidate = ['name', 'campaignType', 'messengerType'];
        break;
      case 1:
        fieldsToValidate = ['templateId'];
        break;
      case 2:
        fieldsToValidate = ['clientGroupId'];
        break;
      case 3:
        fieldsToValidate = ['profileIds'];
        break;
      case 4:
        // schedule (optional)
        break;
      case 5:
        // options (optional)
        break;
    }

    if (fieldsToValidate.length > 0) {
      const isStepValid = await trigger(fieldsToValidate);
      if (!isStepValid) {
        // Берем первую ошибку из нужных полей
        const firstError = fieldsToValidate
          .map((field) => {
            const fieldError = errors[field];
            return fieldError?.message as string | undefined;
          })
          .find(Boolean);
        setStepError(firstError || 'Заполните обязательные поля на этом шаге.');
        return;
      }
    }
    setStepError(null);

    if (activeStep === WIZARD_STEPS.length - 1) {
      // Последний шаг - создаем кампанию
      handleCreateCampaign();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setValue('templateId', template.id);
  };

  const handleCreateCampaign = () => {
    const data = watchedValues;
    
    // Валидация обязательных полей
    if (!data.profileIds || data.profileIds.length === 0) {
      setStepError('Необходимо выбрать хотя бы один профиль');
      setActiveStep(3); // Переходим на шаг выбора профилей
      return;
    }
    
    // Преобразуем в формат API
    const input: CreateCampaignInput = {
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      campaignType: data.campaignType,
      messengerType: data.messengerType,
      universalTarget: data.messengerType === 'UNIVERSAL' ? (data.universalTarget || 'WHATSAPP_FIRST') : undefined,
      templateId: data.templateId,
      clientGroupId: data.clientGroupId,
      profileIds: data.profileIds,
      scheduledAt: data.scheduledAt || undefined,
      filterConfig: data.filterConfig,
      optionsConfig: data.optionsConfig,
      scheduleConfig: data.scheduleConfig,
    };

    createMutation.mutate(input, {
      onSuccess: (campaign) => {
        navigate(`/campaigns/${campaign.id}`);
      },
    });
  };

  // Render шагов
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderStep1BasicInfo();
      case 1:
        return renderStep2SelectTemplate();
      case 2:
        return renderStep3SelectBase();
      case 3:
        return renderStep4SelectProfiles();
      case 4:
        return renderStep5Schedule();
      case 5:
        return renderStep6Options();
      case 6:
        return renderStep7Review();
      default:
        return null;
    }
  };

  // Шаг 1: Основная информация
  const renderStep1BasicInfo = () => <WizardStep1_BasicInfo />;

  // Шаг 2: Выбор шаблона
  const renderStep2SelectTemplate = () => (
    <WizardStep2_SelectTemplate
      templatesLoading={templatesLoading}
      filteredTemplates={filteredTemplates}
      selectedTemplate={selectedTemplate}
      onSelectTemplate={handleSelectTemplate}
    />
  );

  // Шаг 3: Выбор базы клиентов
  const renderStep3SelectBase = () => (
    <WizardStep3_SelectBase
      clientGroupsData={clientGroupsData}
      groupsLoading={groupsLoading}
    />
  );

  // Шаг 4: Выбор профилей
  const renderStep4SelectProfiles = () => <WizardStep4_SelectProfiles />;

  const renderStep5Schedule = () => <WizardStep5_Schedule />;

  const renderStep6Options = () => <WizardStep6_Options />;

  const renderStep7Review = () => (
    <WizardStep7_Review
      selectedTemplate={selectedTemplate}
      clientGroupsData={clientGroupsData}
    />
  );

  return (
    <FormProvider {...formMethods}>
      <Box
        sx={{
          width: '100%',
          overflowY: 'auto',
          '&::-webkit-scrollbar': {
            display: 'none',
            width: 0,
            height: 0,
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '& *': {
            '&::-webkit-scrollbar': {
              display: 'none',
              width: 0,
              height: 0,
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Breadcrumbs sx={{ mb: 2 }}>
              <Link
                href="/campaigns"
                onClick={(e) => { e.preventDefault(); navigate('/campaigns'); }}
                sx={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.7)', '&:hover': { color: '#6366f1' } }}
              >
                Кампании
              </Link>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>Создание</Typography>
            </Breadcrumbs>

            <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
              Создание кампании
            </Typography>
          </Box>

          {/* Stepper */}
          <Paper sx={{ p: 3.5, mb: 3, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
            <Stepper 
              activeStep={activeStep} 
              alternativeLabel
              sx={{
                '& .MuiStepLabel-root .Mui-completed': {
                  color: '#6366f1',
                },
                '& .MuiStepLabel-label.Mui-completed.MuiStepLabel-alternativeLabel': {
                  color: '#818cf8',
                },
                '& .MuiStepLabel-root .Mui-active': {
                  color: '#6366f1',
                },
                '& .MuiStepLabel-label.Mui-active.MuiStepLabel-alternativeLabel': {
                  color: '#f5f5f5',
                  fontWeight: 500,
                },
                '& .MuiStepLabel-root .Mui-active .MuiStepIcon-text': {
                  fill: '#fff',
                },
                '& .MuiStepLabel-label': {
                  color: 'rgba(255, 255, 255, 0.5)',
                },
              }}
            >
              {WIZARD_STEPS.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel
                    optional={
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        {step.description}
                      </Typography>
                    }
                  >
                    {step.label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>

          {/* Content */}
          <Paper sx={{ p: 3.5, mb: 3, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
            {(createMutation.error || stepError) && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: '12px',
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  color: '#f44336',
                  border: '1px solid rgba(244, 67, 54, 0.2)',
                }}
              >
                {stepError || (createMutation.error as Error).message}
              </Alert>
            )}

            {renderStepContent()}
          </Paper>

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <StyledButton
              onClick={handleBack}
              startIcon={<BackIcon />}
              disabled={createMutation.isPending}
              variant="outlined"
            >
              {activeStep === 0 ? 'Отмена' : 'Назад'}
            </StyledButton>

            <StyledButton
              onClick={handleNext}
              endIcon={activeStep === WIZARD_STEPS.length - 1 ? <CheckIcon /> : <NextIcon />}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
              ) : activeStep === WIZARD_STEPS.length - 1 ? (
                'Создать кампанию'
              ) : (
                'Далее'
              )}
            </StyledButton>
          </Box>
        </Box>
      </Box>
    </FormProvider>
  );
}

