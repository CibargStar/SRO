/**
 * Диалог настройки конфигурации импорта
 * 
 * Позволяет детально настроить все параметры импорта клиентов:
 * - Область поиска дубликатов
 * - Действия при дубликате и отсутствии дубликата
 * - Валидация и фильтрация
 * - Дополнительные опции
 * 
 * Поддерживает сохранение конфигураций и загрузку из шаблонов.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Tabs,
  Tab,
  Paper,
  Select,
  MenuItem,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import { useImportConfigs, useCreateImportConfig, useUpdateImportConfig, useCreateConfigFromTemplate, useDeleteImportConfig } from '@/hooks/useImportConfigs';
import { useAuthStore } from '@/store';
import type { ImportConfig } from '@/utils/api';

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: '#f5f5f5',
  color: '#212121',
  textTransform: 'none',
  fontWeight: 500,
  padding: theme.spacing(1.5, 3),
  '&:hover': { backgroundColor: '#ffffff', transform: 'translateY(-2px)' },
}));

const CancelButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: 'transparent',
  color: 'rgba(255, 255, 255, 0.7)',
  textTransform: 'none',
  padding: theme.spacing(1.5, 3),
  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' },
}));

const DeleteButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: 'transparent',
  color: '#f44336',
  textTransform: 'none',
  padding: theme.spacing(1.5, 3),
  '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#f44336' },
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '12px',
}));

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    '& fieldset': { border: 'none' },
    '&:hover fieldset': { border: 'none' },
    '&.Mui-focused fieldset': { border: 'none' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255, 255, 255, 0.9)' },
  '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.5)' },
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface ImportConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ImportConfig | null) => void;
  initialConfig?: ImportConfig | null;
}

export function ImportConfigDialog({ open, onClose, onSave, initialConfig }: ImportConfigDialogProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [config, setConfig] = useState<ImportConfig>(() => {
    if (initialConfig) {
      return initialConfig;
    }
    // Значения по умолчанию
    return {
      name: 'Новая конфигурация',
      description: '',
      userId: '',
      isDefault: false,
      searchScope: {
        scopes: ['owner_groups'],
        matchCriteria: 'phone',
      },
      duplicateAction: {
        defaultAction: 'update',
        updateName: true,
        updateRegion: false,
        addPhones: true,
        addToGroup: true,
        moveToGroup: false,
      },
      noDuplicateAction: 'create',
      validation: {
        requireName: false,
        requirePhone: true,
        requireRegion: false,
        errorHandling: 'skip',
      },
      additional: {
        newClientStatus: 'NEW',
        updateStatus: false,
      },
    };
  });

  const { data: configsData, isLoading: configsLoading } = useImportConfigs(true);
  const createMutation = useCreateImportConfig();
  const updateMutation = useUpdateImportConfig();
  const createFromTemplateMutation = useCreateConfigFromTemplate();
  const deleteMutation = useDeleteImportConfig();
  const userId = useAuthStore((state) => state.user?.id || '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Обновляем userId в конфигурации
  useEffect(() => {
    if (userId && !config.userId) {
      setConfig((prev) => ({ ...prev, userId }));
    }
  }, [userId, config.userId]);

  // Обновляем конфигурацию при изменении initialConfig
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setSaveError(null);
    }
  }, [initialConfig]);

  // Сброс ошибок при закрытии
  useEffect(() => {
    if (!open) {
      setSaveError(null);
      setLoadingTemplateId(null);
      setActiveTab(0);
      setDeleteConfirmOpen(false);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!config.id) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(config.id);
      setDeleteConfirmOpen(false);
      onClose();
      // Вызываем onSave с null, чтобы уведомить родительский компонент об удалении
      onSave(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Не удалось удалить конфигурацию');
    }
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      setSaveError('Название конфигурации обязательно');
      return;
    }

    // Проверка валидности конфигурации
    if (config.searchScope.scopes.length === 0 || 
        (config.searchScope.scopes.length === 1 && config.searchScope.scopes[0] === 'none' && config.searchScope.matchCriteria !== 'phone')) {
      // Это нормально, если поиск отключен
    }

    setSaveError(null);

    try {
      if (config.id) {
        // Обновление существующей конфигурации
        const updatedConfig = await updateMutation.mutateAsync({
          configId: config.id,
          config: {
            name: config.name,
            description: config.description || null,
            isDefault: config.isDefault || false,
            searchScope: config.searchScope,
            duplicateAction: config.duplicateAction,
            noDuplicateAction: config.noDuplicateAction,
            validation: config.validation,
            additional: config.additional,
          },
        });
        onSave(updatedConfig);
      } else {
        // Создание новой конфигурации
        const newConfig = await createMutation.mutateAsync({
          name: config.name,
          description: config.description,
          isDefault: config.isDefault,
          searchScope: config.searchScope,
          duplicateAction: config.duplicateAction,
          noDuplicateAction: config.noDuplicateAction,
          validation: config.validation,
          additional: config.additional,
        });
        setConfig(newConfig);
        onSave(newConfig);
      }
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить конфигурацию');
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    try {
      setLoadingTemplateId(templateId);
      setSaveError(null);
      const templateName = templateId.replace('template_', '');
      const template = configsData?.templates?.find((t) => t.id === templateId);
      const templateConfig = await createFromTemplateMutation.mutateAsync({
        templateName,
        customName: `${template?.name || templateName} (копия)`,
      });
      setConfig(templateConfig);
      setActiveTab(0); // Переключаем на первую вкладку для просмотра
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Не удалось загрузить шаблон');
    } finally {
      setLoadingTemplateId(null);
    }
  };

  const handleLoadSaved = (savedConfig: ImportConfig) => {
    setSaveError(null);
    setConfig(savedConfig);
    setActiveTab(0); // Переключаем на первую вкладку для просмотра
  };

  // Генерация предпросмотра конфигурации
  const generatePreview = (): string[] => {
    const preview: string[] = [];

    // Область поиска
    if (config.searchScope.scopes.includes('none')) {
      preview.push('• Поиск дубликатов: отключен');
    } else {
      const scopes = config.searchScope.scopes.map((s) => {
        if (s === 'current_group') return 'в выбранной группе';
        if (s === 'owner_groups') return 'во всех группах владельца';
        if (s === 'all_users') return 'по всем пользователям';
        return s;
      });
      preview.push(`• Поиск дубликатов: ${scopes.join(', ')}`);
      preview.push(`• Критерии поиска: ${config.searchScope.matchCriteria === 'phone' ? 'по телефону' : config.searchScope.matchCriteria === 'phone_and_name' ? 'по телефону + ФИО' : 'по ФИО'}`);
    }

    // Действия при дубликате
    const duplicateActions: string[] = [];
    if (config.duplicateAction.defaultAction === 'skip') {
      duplicateActions.push('пропустить');
    } else if (config.duplicateAction.defaultAction === 'update') {
      duplicateActions.push('обновить');
      if (config.duplicateAction.updateName) duplicateActions.push('обновить ФИО');
      if (config.duplicateAction.addPhones) duplicateActions.push('добавить телефоны');
      if (config.duplicateAction.updateRegion) duplicateActions.push('обновить регион');
      if (config.duplicateAction.addToGroup) duplicateActions.push('добавить в группу');
      if (config.duplicateAction.moveToGroup) duplicateActions.push('переместить в группу');
    } else {
      duplicateActions.push('создать нового');
    }
    preview.push(`• При дубликате: ${duplicateActions.join(', ')}`);

    // Действие при отсутствии дубликата
    preview.push(`• При отсутствии дубликата: ${config.noDuplicateAction === 'create' ? 'создать нового' : 'пропустить'}`);

    // Валидация
    const validationRules: string[] = [];
    if (config.validation.requireName) validationRules.push('обязательно ФИО');
    if (config.validation.requirePhone) validationRules.push('обязателен телефон');
    if (config.validation.requireRegion) validationRules.push('обязателен регион');
    if (validationRules.length > 0) {
      preview.push(`• Валидация: ${validationRules.join(', ')}`);
    }
    preview.push(`• Обработка ошибок: ${config.validation.errorHandling === 'stop' ? 'остановить' : config.validation.errorHandling === 'skip' ? 'пропустить' : 'предупреждение'}`);

    // Дополнительно
    preview.push(`• Статус новых клиентов: ${config.additional.newClientStatus}`);
    if (config.additional.updateStatus) {
      preview.push('• Обновлять статус существующих клиентов');
    }

    return preview;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus
      PaperProps={{ 
        sx: { 
          backgroundColor: '#212121', 
          borderRadius: '12px',
          '& .MuiDialogContent-root': {
            '&::-webkit-scrollbar': {
              display: 'none',
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
        } 
      }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Настройка импорта
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, pt: 3 }}>
        {/* Ошибка сохранения */}
        {saveError && (
          <Alert
            severity="error"
            onClose={() => setSaveError(null)}
            icon={<ErrorIcon sx={{ color: '#f44336' }} />}
            sx={{
              mb: 3,
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#ffffff',
              border: 'none',
              '& .MuiAlert-message': {
                color: '#ffffff',
              },
            }}
          >
            {saveError}
          </Alert>
        )}

        {/* Базовые настройки */}
        <Box sx={{ mb: 3 }}>
          <StyledTextField
            fullWidth
            label="Название конфигурации"
            value={config.name}
            onChange={(e) => {
              setConfig({ ...config, name: e.target.value });
              setSaveError(null);
            }}
            error={!config.name.trim()}
            helperText={!config.name.trim() ? 'Название обязательно' : ''}
            sx={{ mb: 2 }}
            required
          />
          <StyledTextField
            fullWidth
            label="Описание (необязательно)"
            value={config.description || ''}
            onChange={(e) => setConfig({ ...config, description: e.target.value })}
            multiline
            rows={2}
            sx={{ mb: 2 }}
            helperText="Краткое описание назначения конфигурации"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={config.isDefault || false}
                onChange={(e) => setConfig({ ...config, isDefault: e.target.checked })}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-checked': { color: '#4caf50' },
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Использовать по умолчанию
                </Typography>
                <Tooltip title="Эта конфигурация будет автоматически выбрана при открытии диалога импорта">
                  <InfoIcon sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }} />
                </Tooltip>
              </Box>
            }
          />
        </Box>

        {/* Загрузка из шаблонов и сохраненных */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1.5, color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
            Загрузить из:
          </Typography>
          
          {/* Шаблоны */}
          {configsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Загрузка шаблонов...
              </Typography>
            </Box>
          ) : (
            <>
              {configsData?.templates && configsData.templates.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 0.5, display: 'block' }}>
                    Предустановленные шаблоны:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {configsData.templates.map((template) => (
                      <Chip
                        key={template.id}
                        label={template.name}
                        onClick={() => handleLoadTemplate(template.id)}
                        disabled={loadingTemplateId === template.id || createFromTemplateMutation.isPending}
                        icon={
                          loadingTemplateId === template.id ? (
                            <CircularProgress size={16} sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                          ) : undefined
                        }
                        sx={{
                          backgroundColor: 'rgba(33, 150, 243, 0.2)',
                          color: '#ffffff',
                          cursor: loadingTemplateId === template.id ? 'wait' : 'pointer',
                          '&:hover': {
                            backgroundColor: loadingTemplateId === template.id ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.3)',
                          },
                          '&.Mui-disabled': {
                            opacity: 0.6,
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {/* Сохраненные конфигурации */}
              {configsData?.configs && configsData.configs.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 0.5, display: 'block' }}>
                    Сохраненные конфигурации:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {configsData.configs.map((savedConfig) => (
                      <Chip
                        key={savedConfig.id}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {savedConfig.name}
                            {savedConfig.isDefault && (
                              <Chip
                                label="По умолчанию"
                                size="small"
                                sx={{
                                  height: '18px',
                                  fontSize: '0.65rem',
                                  backgroundColor: 'rgba(76, 175, 80, 0.3)',
                                  color: '#4caf50',
                                  ml: 0.5,
                                }}
                              />
                            )}
                          </Box>
                        }
                        onClick={() => handleLoadSaved(savedConfig)}
                        sx={{
                          backgroundColor: 'rgba(76, 175, 80, 0.2)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.3)' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {(!configsData?.templates || configsData.templates.length === 0) &&
               (!configsData?.configs || configsData.configs.length === 0) && (
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
                  Нет доступных шаблонов или сохраненных конфигураций
                </Typography>
              )}
            </>
          )}
        </Box>

        {/* Вкладки настроек */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              '&.Mui-selected': { color: '#ffffff' },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#4caf50',
            },
          }}
        >
          <Tab label="Поиск" />
          <Tab label="Действия" />
          <Tab label="Валидация" />
          <Tab label="Дополнительно" />
          <Tab label="Предпросмотр" />
        </Tabs>

        {/* Вкладка: Поиск */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <FormLabel sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1.5, fontWeight: 500 }}>
                Область поиска дубликатов:
              </FormLabel>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.searchScope.scopes.includes('none')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfig({
                          ...config,
                          searchScope: { ...config.searchScope, scopes: ['none'] },
                        });
                      } else {
                        setConfig({
                          ...config,
                          searchScope: { ...config.searchScope, scopes: ['owner_groups'] },
                        });
                      }
                    }}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': { color: '#4caf50' },
                    }}
                  />
                }
                label="Не искать дубликаты"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.searchScope.scopes.includes('current_group')}
                    onChange={(e) => {
                      const scopes = config.searchScope.scopes.filter((s) => s !== 'none');
                      if (e.target.checked) {
                        setConfig({
                          ...config,
                          searchScope: { ...config.searchScope, scopes: [...scopes, 'current_group'] },
                        });
                      } else {
                        setConfig({
                          ...config,
                          searchScope: {
                            ...config.searchScope,
                            scopes: scopes.filter((s) => s !== 'current_group'),
                          },
                        });
                      }
                    }}
                    disabled={config.searchScope.scopes.includes('none')}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': { color: '#4caf50' },
                    }}
                  />
                }
                label="Только в выбранной группе"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.searchScope.scopes.includes('owner_groups')}
                    onChange={(e) => {
                      const scopes = config.searchScope.scopes.filter((s) => s !== 'none');
                      if (e.target.checked) {
                        setConfig({
                          ...config,
                          searchScope: { ...config.searchScope, scopes: [...scopes, 'owner_groups'] },
                        });
                      } else {
                        setConfig({
                          ...config,
                          searchScope: {
                            ...config.searchScope,
                            scopes: scopes.filter((s) => s !== 'owner_groups'),
                          },
                        });
                      }
                    }}
                    disabled={config.searchScope.scopes.includes('none')}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': { color: '#4caf50' },
                    }}
                  />
                }
                label="Во всех группах владельца"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              </Box>
            </FormControl>
          </Box>

          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          <FormControl fullWidth>
            <FormLabel sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1.5, fontWeight: 500 }}>
              Критерии поиска:
            </FormLabel>
            <RadioGroup
              value={config.searchScope.matchCriteria}
              onChange={(e) =>
                setConfig({
                  ...config,
                  searchScope: { ...config.searchScope, matchCriteria: e.target.value as 'phone' | 'phone_and_name' | 'name' },
                })
              }
            >
              <FormControlLabel
                value="phone"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="По телефону"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="phone_and_name"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="По телефону + ФИО"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="name"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="По ФИО"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
            </RadioGroup>
          </FormControl>
        </TabPanel>

        {/* Вкладка: Действия */}
        <TabPanel value={activeTab} index={1}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <FormLabel sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1.5, fontWeight: 500 }}>
              Действие по умолчанию при дубликате:
            </FormLabel>
            <RadioGroup
              value={config.duplicateAction.defaultAction}
              onChange={(e) =>
                setConfig({
                  ...config,
                  duplicateAction: {
                    ...config.duplicateAction,
                    defaultAction: e.target.value as 'skip' | 'update' | 'create',
                  },
                })
              }
            >
              <FormControlLabel
                value="skip"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Пропустить строку"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="update"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Обновить существующего"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="create"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Создать нового (игнорировать дубликат)"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
            </RadioGroup>
          </FormControl>

          {config.duplicateAction.defaultAction === 'update' && (
            <Box sx={{ mb: 3, mt: 2, p: 2, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <Typography variant="body2" sx={{ mb: 1.5, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                Что обновлять:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.duplicateAction.updateName}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        duplicateAction: { ...config.duplicateAction, updateName: e.target.checked },
                      })
                    }
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': { color: '#4caf50' },
                    }}
                  />
                }
                label="Обновлять ФИО (если в импорте есть, а у существующего нет)"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.duplicateAction.addPhones}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        duplicateAction: { ...config.duplicateAction, addPhones: e.target.checked },
                      })
                    }
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': { color: '#4caf50' },
                    }}
                  />
                }
                label="Добавлять новые телефоны"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.duplicateAction.updateRegion}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        duplicateAction: { ...config.duplicateAction, updateRegion: e.target.checked },
                      })
                    }
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': { color: '#4caf50' },
                    }}
                  />
                }
                label="Обновлять регион"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.duplicateAction.addToGroup}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        duplicateAction: { ...config.duplicateAction, addToGroup: e.target.checked },
                      })
                    }
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': { color: '#4caf50' },
                    }}
                  />
                }
                label="Добавлять клиента в текущую группу (если его там нет)"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.duplicateAction.moveToGroup}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        duplicateAction: {
                          ...config.duplicateAction,
                          moveToGroup: e.target.checked,
                          addToGroup: e.target.checked ? false : config.duplicateAction.addToGroup,
                        },
                      })
                    }
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-checked': { color: '#4caf50' },
                    }}
                  />
                }
                label="Перемещать клиента в текущую группу (удалять из других)"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          <FormControl fullWidth>
            <FormLabel sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1.5, fontWeight: 500 }}>
              Действие при отсутствии дубликата:
            </FormLabel>
            <RadioGroup
              value={config.noDuplicateAction}
              onChange={(e) =>
                setConfig({
                  ...config,
                  noDuplicateAction: e.target.value as 'create' | 'skip',
                })
              }
            >
              <FormControlLabel
                value="create"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Создать нового клиента"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="skip"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Пропустить строку"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
            </RadioGroup>
          </FormControl>
        </TabPanel>

        {/* Вкладка: Валидация */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1.5, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
              Обязательные поля:
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 2, display: 'block' }}>
              Строки без этих полей будут пропущены
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
            control={
              <Checkbox
                checked={config.validation.requireName}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    validation: { ...config.validation, requireName: e.target.checked },
                  })
                }
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-checked': { color: '#4caf50' },
                }}
              />
            }
            label="Требовать ФИО"
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={config.validation.requirePhone}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    validation: { ...config.validation, requirePhone: e.target.checked },
                  })
                }
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-checked': { color: '#4caf50' },
                }}
              />
            }
            label="Требовать валидный телефон"
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={config.validation.requireRegion}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    validation: { ...config.validation, requireRegion: e.target.checked },
                  })
                }
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-checked': { color: '#4caf50' },
                }}
              />
            }
            label="Требовать регион"
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          />
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          <FormControl fullWidth>
            <FormLabel sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1.5, fontWeight: 500 }}>
              Обработка ошибок валидации:
            </FormLabel>
            <RadioGroup
              value={config.validation.errorHandling}
              onChange={(e) =>
                setConfig({
                  ...config,
                  validation: {
                    ...config.validation,
                    errorHandling: e.target.value as 'stop' | 'skip' | 'warn',
                  },
                })
              }
            >
              <FormControlLabel
                value="stop"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Останавливать импорт при первой ошибке"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="skip"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Пропускать строки с ошибками и продолжать"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="warn"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Показывать предупреждения и продолжать"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
            </RadioGroup>
          </FormControl>
        </TabPanel>

        {/* Вкладка: Дополнительно */}
        <TabPanel value={activeTab} index={3}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <FormLabel sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1.5, fontWeight: 500 }}>
              Статус для новых клиентов:
            </FormLabel>
            <RadioGroup
              value={config.additional.newClientStatus}
              onChange={(e) =>
                setConfig({
                  ...config,
                  additional: {
                    ...config.additional,
                    newClientStatus: e.target.value as 'NEW' | 'OLD' | 'from_file',
                  },
                })
              }
            >
              <FormControlLabel
                value="NEW"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="NEW (новый клиент)"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="OLD"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="OLD (старый клиент)"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
              <FormControlLabel
                value="from_file"
                control={<Radio sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Из файла (если есть колонка status)"
                sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
              />
            </RadioGroup>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={config.additional.updateStatus}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    additional: { ...config.additional, updateStatus: e.target.checked },
                  })
                }
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-checked': { color: '#4caf50' },
                }}
              />
            }
            label="Обновлять статус существующих клиентов"
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          />
        </TabPanel>

        {/* Вкладка: Предпросмотр */}
        <TabPanel value={activeTab} index={4}>
          <StyledPaper>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <InfoIcon sx={{ color: 'rgba(33, 150, 243, 0.7)' }} />
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                Предпросмотр конфигурации
              </Typography>
            </Box>
            <Box
              component="ul"
              sx={{
                pl: 2.5,
                m: 0,
                color: 'rgba(255, 255, 255, 0.9)',
                '& li': {
                  mb: 1.5,
                  lineHeight: 1.6,
                },
              }}
            >
              {generatePreview().map((line, index) => (
                <li key={index}>
                  <Typography variant="body2" component="span" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    {line}
                  </Typography>
                </li>
              ))}
            </Box>
          </StyledPaper>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2, justifyContent: config.id ? 'space-between' : 'flex-end' }}>
        {config.id && (
          <Box>
            <DeleteButton
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={
                createMutation.isPending || 
                updateMutation.isPending || 
                createFromTemplateMutation.isPending ||
                deleteMutation.isPending
              }
              startIcon={deleteMutation.isPending ? <CircularProgress size={16} sx={{ color: '#f44336' }} /> : <DeleteIcon />}
            >
              Удалить
            </DeleteButton>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <CancelButton 
            onClick={onClose}
            disabled={
              createMutation.isPending || 
              updateMutation.isPending || 
              createFromTemplateMutation.isPending ||
              deleteMutation.isPending
            }
          >
            Отмена
          </CancelButton>
          <StyledButton
            onClick={handleSave}
            disabled={
              !config.name.trim() || 
              createMutation.isPending || 
              updateMutation.isPending || 
              createFromTemplateMutation.isPending ||
              deleteMutation.isPending ||
              configsLoading
            }
            startIcon={
              (createMutation.isPending || updateMutation.isPending) ? (
                <CircularProgress size={20} sx={{ color: '#212121' }} />
              ) : undefined
            }
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Сохранение...'
              : config.id
                ? 'Сохранить изменения'
                : 'Сохранить конфигурацию'}
          </StyledButton>
        </Box>
      </DialogActions>

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{ 
        sx: { 
          backgroundColor: '#212121', 
          borderRadius: '12px',
          '& .MuiDialogContent-root': {
            '&::-webkit-scrollbar': {
              display: 'none',
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
        } 
      }}
      >
        <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Подтверждение удаления
          </Typography>
        </Box>
        <DialogContent sx={{ px: 3, pt: 3 }}>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 2 }}>
            Вы уверены, что хотите удалить конфигурацию <strong>"{config.name}"</strong>?
          </Typography>
          <Alert
            severity="warning"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              color: '#ffffff',
              border: 'none',
              '& .MuiAlert-message': {
                color: '#ffffff',
              },
            }}
          >
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Это действие нельзя отменить. Конфигурация будет удалена безвозвратно.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <CancelButton
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Отмена
          </CancelButton>
          <DeleteButton
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} sx={{ color: '#f44336' }} /> : <DeleteIcon />}
          >
            {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
          </DeleteButton>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

