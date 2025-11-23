/**
 * Диалог импорта клиентов из Excel файла
 * 
 * Позволяет загрузить Excel файл (XLSX, XLS, CSV) и импортировать клиентов в выбранную группу.
 * Отображает прогресс импорта и статистику результатов.
 */

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  CircularProgress,
  Typography,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import LockIcon from '@mui/icons-material/Lock';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useImportClients } from '@/hooks/useImport';
import { useClientGroups } from '@/hooks/useClientGroups';
import { useImportConfigs, useDefaultImportConfig } from '@/hooks/useImportConfigs';
import { CreateClientGroupDialog } from './CreateClientGroupDialog';
import { ImportConfigDialog } from './ImportConfigDialog';
import { StyledSelect, MenuProps, selectInputLabelStyles } from './common/SelectStyles';
import { StyledButton, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import type { ImportClientsResponse, ImportConfig } from '@/utils/api';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '12px',
}));

const UploadArea = styled(Box)(({ theme }) => ({
  border: '2px dashed rgba(255, 255, 255, 0.3)',
  borderRadius: '12px',
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.3s',
  backgroundColor: 'rgba(255, 255, 255, 0.02)',
  '&:hover': {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
}));

const HiddenInput = styled('input')({
  display: 'none',
});


interface ImportClientsDialogProps {
  open: boolean;
  onClose: () => void;
  userId?: string; // Опциональный ID пользователя для ROOT (передается из родительского компонента)
}

export function ImportClientsDialog({ open, onClose, userId: propUserId }: ImportClientsDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [groupId, setGroupId] = useState<string>('');
  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(undefined);
  const [importResult, setImportResult] = useState<ImportClientsResponse | null>(null);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: groups = [], isLoading: groupsLoading } = useClientGroups(propUserId);
  const { data: configsData, isLoading: configsLoading } = useImportConfigs(false);
  const { data: defaultConfig, isLoading: defaultConfigLoading } = useDefaultImportConfig();
  const importMutation = useImportClients();

  // Проверяем наличие сохраненных конфигураций (не считая системную "Новую конфигурацию")
  const hasSavedConfigs = !configsLoading && !defaultConfigLoading && (
    (configsData?.configs && configsData.configs.length > 0) || 
    (defaultConfig?.id && defaultConfig.id !== 'default')
  );
  
  // Проверяем, выбрана ли новая конфигурация (системная, без id)
  // Новая конфигурация - это когда selectedConfigId === 'default'
  const isNewConfigSelected = selectedConfigId === 'default';
  
  // Проверяем, существует ли выбранная конфигурация (сохраненная)
  // Существующая конфигурация - это когда selectedConfigId есть в списке сохраненных конфигов
  // или когда это defaultConfig с реальным id (не системная)
  const selectedConfigExists = selectedConfigId && 
    selectedConfigId !== 'default' && 
    (
      (defaultConfig?.id && defaultConfig.id !== 'default' && defaultConfig.id === selectedConfigId) ||
      (configsData?.configs?.some((c) => c.id === selectedConfigId) ?? false)
    );

  // Устанавливаем конфигурацию по умолчанию при открытии модалки и загрузке данных
  React.useEffect(() => {
    if (!open) {
      // Сбрасываем состояние при закрытии модалки
      setSelectedConfigId(undefined);
      setImportResult(null);
      setSelectedFile(null);
      setFileError(null);
      setGroupId('');
    } else if (open && !selectedConfigId && defaultConfig && !defaultConfigLoading) {
      // При открытии модалки устанавливаем конфигурацию по умолчанию
      // Если у конфигурации по умолчанию есть id, используем его, иначе используем специальное значение 'default'
      setSelectedConfigId(defaultConfig.id || 'default');
    }
  }, [open, defaultConfig, selectedConfigId, defaultConfigLoading]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Проверка формата файла
      const allowedExtensions = ['.xlsx', '.xls', '.csv'];
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(ext)) {
        setFileError('Неподдерживаемый формат файла. Разрешены: .xlsx, .xls, .csv');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      // Проверка размера файла (максимум 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        setFileError(`Файл слишком большой. Максимальный размер: ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      setFileError(null);
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (!selectedFile || !groupId) {
      return;
    }

    // Импортируем сразу (настройки дедупликации теперь в конфигурации)
    await performImport();
  };

  const performImport = async () => {
    if (!selectedFile || !groupId) {
      return;
    }

    try {
      const result =       await importMutation.mutateAsync({
        groupId,
        file: selectedFile,
        // Если выбрана системная конфигурация по умолчанию (без id), передаем undefined
        configId: selectedConfigId === 'default' ? undefined : selectedConfigId,
      });
      setImportResult(result);
    } catch (error) {
      // Ошибка обрабатывается через mutation.error
    }
  };

  const handleConfigSaved = (config: ImportConfig | null) => {
    if (config && config.id) {
      setSelectedConfigId(config.id);
    } else if (config === null) {
      // Конфигурация была удалена, сбрасываем выбор
      setSelectedConfigId(undefined);
      // Устанавливаем конфигурацию по умолчанию, если она есть
      if (defaultConfig) {
        setSelectedConfigId(defaultConfig.id || 'default');
      }
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setGroupId('');
    setSelectedConfigId(undefined);
    setImportResult(null);
    setFileError(null);
    setCreateGroupDialogOpen(false);
    setConfigDialogOpen(false);
    importMutation.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleGroupCreated = (newGroupId: string) => {
    setGroupId(newGroupId);
    setCreateGroupDialogOpen(false);
  };

  const isLoading = importMutation.isPending;
  const error = importMutation.error;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus
      PaperProps={{ ...dialogPaperProps, sx: { ...dialogPaperProps.sx, '& .MuiDialogContent-root': { ...dialogPaperProps.sx['& .MuiDialogContent-root'], overflow: 'hidden' } } }}
    >
      <Box sx={dialogTitleStyles}>
        <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Импорт клиентов из Excel
        </Typography>
      </Box>

      <DialogContent sx={{ ...dialogContentStyles, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Выбор группы (скрывается после завершения импорта) */}
          {!importResult && (
            <Box>
              {!groupsLoading && groups.length === 0 ? (
                <Alert 
                  severity="warning" 
                  icon={false}
                  sx={{ 
                    mb: 2, 
                    borderRadius: '12px', 
                    backgroundColor: 'rgba(255, 152, 0, 0.1)', 
                    color: '#ffffff', 
                    border: 'none',
                    '& .MuiAlert-message': {
                      width: '100%',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                      <WarningIcon sx={{ color: '#ff9800', fontSize: '20px', flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: '#ffffff', mb: 0 }}>
                        У вас нет групп клиентов. Создайте группу перед импортом.
                      </Typography>
                    </Box>
                    <StyledButton
                      size="small"
                      onClick={() => setCreateGroupDialogOpen(true)}
                      sx={{ flexShrink: 0 }}
                    >
                      Создать группу
                    </StyledButton>
                  </Box>
                </Alert>
              ) : (
                <FormControl fullWidth required disabled={isLoading || groupsLoading}>
                  <InputLabel sx={selectInputLabelStyles}>
                    Группа
                  </InputLabel>
                  <StyledSelect
                    value={groupId || ''}
                    onChange={(e) => setGroupId(e.target.value || '')}
                    label="Группа"
                    MenuProps={MenuProps}
                    disabled={isLoading || groupsLoading}
                  >
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                </FormControl>
              )}
            </Box>
          )}

          {/* Выбор конфигурации импорта */}
          {!importResult && (
            <Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl sx={{ flex: 1 }} disabled={isLoading || configsLoading || defaultConfigLoading || !hasSavedConfigs}>
                  <InputLabel 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-disabled': {
                        color: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused': {
                        color: 'rgba(255, 255, 255, 0.7)',
                      },
                      '&.MuiInputLabel-shrink': {
                        color: 'rgba(255, 255, 255, 0.7)',
                      },
                    }}
                  >
                    Выберите конфигурацию
                  </InputLabel>
                  <Box sx={{ position: 'relative', width: '100%' }}>
                    <StyledSelect
                      value={selectedConfigId || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Если значение пустое, устанавливаем undefined, иначе сохраняем значение (включая 'default')
                        setSelectedConfigId(value === '' ? undefined : value);
                      }}
                      label="Выберите конфигурацию"
                      disabled={isLoading || configsLoading || defaultConfigLoading || !hasSavedConfigs}
                      IconComponent={ArrowDropDownIcon}
                      fullWidth
                      MenuProps={MenuProps}
                    >
                  {defaultConfigLoading || configsLoading ? (
                    <MenuItem value="" disabled>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      Загрузка...
                    </MenuItem>
                  ) : (
                    [
                      defaultConfig && (
                        <MenuItem key={defaultConfig.id || 'default'} value={defaultConfig.id || 'default'}>
                          {defaultConfig.name} {defaultConfig.isDefault ? '(по умолчанию)' : ''}
                        </MenuItem>
                      ),
                      ...(configsData?.configs
                        ?.filter((c) => c.id !== defaultConfig?.id)
                        .map((config) => (
                          <MenuItem key={config.id} value={config.id || ''}>
                            {config.name}
                          </MenuItem>
                        )) || []),
                      !defaultConfig && (!configsData?.configs || configsData.configs.length === 0) && (
                        <MenuItem key="no-configs" value="" disabled>
                          Нет сохраненных конфигураций
                        </MenuItem>
                      ),
                    ].filter(Boolean)
                  )}
                    </StyledSelect>
                    {(isLoading || configsLoading || defaultConfigLoading || !hasSavedConfigs) && (
                      <LockIcon 
                        sx={{ 
                          position: 'absolute',
                          right: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'rgba(255, 255, 255, 0.5)',
                          fontSize: '20px',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }} 
                      />
                    )}
                  </Box>
              </FormControl>
              <StyledButton
                size="small"
                onClick={() => setConfigDialogOpen(true)}
                disabled={isLoading}
                sx={{ minWidth: 'auto', px: 2, whiteSpace: 'nowrap' }}
              >
                {isNewConfigSelected ? 'Создать' : 'Настроить'}
              </StyledButton>
              </Box>
            </Box>
          )}

          {/* Ошибка выбора файла */}
          {fileError && !importResult && (
            <Alert
              severity="error"
              onClose={() => setFileError(null)}
              sx={{
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#ffffff',
                border: 'none',
                '& .MuiAlert-message': {
                  color: '#ffffff',
                },
              }}
            >
              {fileError}
            </Alert>
          )}

          {/* Загрузка файла */}
          {!importResult && (
            <Box>
              <UploadArea 
                onClick={handleUploadClick}
                sx={{
                  ...(selectedFile && {
                    borderColor: 'rgba(76, 175, 80, 0.5)',
                    backgroundColor: 'rgba(76, 175, 80, 0.05)',
                  }),
                }}
              >
                {selectedFile ? (
                  <>
                    <CheckCircleIcon sx={{ fontSize: 48, color: '#4caf50', mb: 2 }} />
                    <Typography variant="body1" sx={{ color: '#ffffff', mb: 0.5, fontWeight: 500 }}>
                      {selectedFile.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.5)', 
                        mt: 1,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      Выбрать другой файл
                    </Typography>
                  </>
                ) : (
                  <>
                    <CloudUploadIcon sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.5)', mb: 2 }} />
                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Нажмите для выбора файла
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                      Поддерживаемые форматы: .xlsx, .xls, .csv
                    </Typography>
                  </>
                )}
                <HiddenInput
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  disabled={isLoading}
                />
              </UploadArea>
            </Box>
          )}

          {/* Прогресс загрузки */}
          {isLoading && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
                Импорт в процессе...
              </Typography>
              <LinearProgress 
                sx={{ 
                  borderRadius: '12px', 
                  height: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#ffffff',
                  },
                }} 
              />
            </Box>
          )}

          {/* Ошибка */}
          {error && (
            <Alert 
              severity="error" 
              icon={<ErrorIcon sx={{ color: '#f44336' }} />}
              sx={{ 
                borderRadius: '12px', 
                backgroundColor: 'rgba(244, 67, 54, 0.1)', 
                color: '#ffffff', 
                border: 'none',
                '& .MuiAlert-message': {
                  color: '#ffffff',
                },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, color: '#ffffff' }}>
                Ошибка импорта
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                {error instanceof Error ? error.message : 'Произошла ошибка при импорте'}
              </Typography>
            </Alert>
          )}

          {/* Результаты импорта */}
          {importResult && (
            <StyledPaper>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                {importResult.success ? (
                  <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 32 }} />
                ) : (
                  <ErrorIcon sx={{ color: '#f44336', fontSize: 32 }} />
                )}
                <Box>
                  <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 0.5 }}>
                    {importResult.success ? 'Импорт завершен успешно' : 'Импорт завершен с ошибками'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Группа: {importResult.groupName}
                  </Typography>
                </Box>
              </Box>

              {/* Статистика */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
                <Chip
                  label={`Всего: ${importResult.statistics.total}`}
                  size="medium"
                  sx={{
                    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    height: '32px',
                    '& .MuiChip-label': {
                      color: '#ffffff',
                      px: 1.5,
                    },
                  }}
                />
                {importResult.statistics.created > 0 && (
                  <Chip
                    label={`Создано: ${importResult.statistics.created}`}
                    size="medium"
                    sx={{
                      backgroundColor: 'rgba(76, 175, 80, 0.2)',
                      color: '#4caf50',
                      fontWeight: 500,
                      height: '32px',
                    }}
                  />
                )}
                {importResult.statistics.updated > 0 && (
                  <Chip
                    label={`Обновлено: ${importResult.statistics.updated}`}
                    size="medium"
                    sx={{
                      backgroundColor: 'rgba(33, 150, 243, 0.2)',
                      color: '#2196f3',
                      fontWeight: 500,
                      height: '32px',
                    }}
                  />
                )}
                {importResult.statistics.skipped > 0 && (
                  <Chip
                    label={`Пропущено: ${importResult.statistics.skipped}`}
                    size="medium"
                    sx={{
                      backgroundColor: 'rgba(255, 152, 0, 0.2)',
                      color: '#ff9800',
                      fontWeight: 500,
                      height: '32px',
                    }}
                  />
                )}
                {importResult.statistics.errors > 0 && (
                  <Chip
                    label={`Ошибок: ${importResult.statistics.errors}`}
                    size="medium"
                    sx={{
                      backgroundColor: 'rgba(244, 67, 54, 0.2)',
                      color: '#f44336',
                      fontWeight: 500,
                      height: '32px',
                    }}
                  />
                )}
                {importResult.statistics.regionsCreated > 0 && (
                  <Chip
                    label={`Регионов создано: ${importResult.statistics.regionsCreated}`}
                    size="medium"
                    sx={{
                      backgroundColor: 'rgba(156, 39, 176, 0.2)',
                      color: '#9c27b0',
                      fontWeight: 500,
                      height: '32px',
                    }}
                  />
                )}
              </Box>

              {/* Детали ошибок */}
              {importResult.errors && importResult.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, color: '#f5f5f5', fontWeight: 600 }}>
                    Ошибки импорта ({importResult.errors.length}):
                  </Typography>
                  <Box
                    sx={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <List dense sx={{ py: 0 }}>
                      {importResult.errors.slice(0, 20).map((error, index) => (
                        <React.Fragment key={index}>
                          <ListItem sx={{ py: 1.5, px: 2 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: '0.75rem',
                                      color: 'rgba(255, 255, 255, 0.5)',
                                      fontWeight: 500,
                                      minWidth: '60px',
                                    }}
                                  >
                                    Строка {error.rowNumber}:
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: '0.875rem',
                                      color: 'rgba(255, 255, 255, 0.9)',
                                      flex: 1,
                                    }}
                                  >
                                    {error.message}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                error.data ? (
                                  <Box sx={{ mt: 0.5, pl: '76px' }}>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: '0.75rem',
                                        color: 'rgba(255, 255, 255, 0.5)',
                                        display: 'block',
                                      }}
                                    >
                                      Имя: {error.data.name || 'не указано'} • Телефон: {error.data.phone} • Регион: {error.data.region}
                                    </Typography>
                                  </Box>
                                ) : undefined
                              }
                            />
                          </ListItem>
                          {index < Math.min(importResult.errors!.length, 20) - 1 && (
                            <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', mx: 2 }} />
                          )}
                        </React.Fragment>
                      ))}
                      {importResult.errors.length > 20 && (
                        <>
                          <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', mx: 2 }} />
                          <ListItem sx={{ py: 1.5, px: 2 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: '0.875rem',
                                fontStyle: 'italic',
                                color: 'rgba(255, 255, 255, 0.6)',
                                textAlign: 'center',
                                width: '100%',
                              }}
                            >
                              ... и еще {importResult.errors.length - 20} ошибок
                            </Typography>
                          </ListItem>
                        </>
                      )}
                    </List>
                  </Box>
                </Box>
              )}
            </StyledPaper>
          )}

          {/* Информация о формате файла */}
          {!importResult && (
            <Alert 
              severity="info" 
              icon={false}
              sx={{ 
                borderRadius: '12px', 
                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                color: '#ffffff', 
                border: 'none',
                '& .MuiAlert-message': {
                  width: '100%',
                },
              }}
            >
              <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                Требования к файлу:
              </Typography>
              <Box component="ul" sx={{ margin: 0, paddingLeft: '24px', color: 'rgba(255, 255, 255, 0.9)' }}>
                <li style={{ marginBottom: '6px' }}>
                  <Typography variant="body2" component="span">
                    <strong>name</strong> (или: имя, фио, full name, полное имя, контакт) — Полное ФИО
                  </Typography>
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <Typography variant="body2" component="span">
                    <strong>phone</strong> (или: телефон, tel, mobile, мобильный, номер) — Номера телефонов
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" component="span">
                    <strong>region</strong> (или: регион, область, город, city, area) — Название региона
                  </Typography>
                </li>
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', mt: 1, display: 'block' }}>
                Максимальный размер файла: 50MB
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={dialogActionsStyles}>
        {!isLoading && (
          <CancelButton onClick={handleClose}>
            {importResult ? 'Закрыть' : 'Отмена'}
          </CancelButton>
        )}
        {!importResult && (
          <StyledButton
            onClick={handleImport}
            disabled={
              !selectedFile || 
              !groupId || 
              isLoading || 
              configsLoading || 
              defaultConfigLoading ||
              !!fileError ||
              isNewConfigSelected // Блокируем импорт при выборе "Новая конфигурация"
            }
            startIcon={isLoading ? <CircularProgress size={LOADING_ICON_SIZE} sx={{ color: '#212121' }} /> : <CloudUploadIcon />}
            sx={isLoading ? {
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              '@keyframes pulse': {
                '0%, 100%': {
                  opacity: 1,
                  transform: 'scale(1)',
                },
                '50%': {
                  opacity: 0.8,
                  transform: 'scale(1.02)',
                },
              },
            } : {}}
          >
            {isLoading ? 'Импорт...' : 'Импортировать'}
          </StyledButton>
        )}
      </DialogActions>

      {/* Диалог создания группы */}
      <CreateClientGroupDialog
        open={createGroupDialogOpen}
        onClose={() => setCreateGroupDialogOpen(false)}
        onSuccess={handleGroupCreated}
        userId={propUserId}
      />

      {/* Диалог настройки конфигурации */}
      <ImportConfigDialog
        key={selectedConfigId || 'new'} // Добавляем key для принудительного пересоздания компонента при изменении selectedConfigId
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleConfigSaved}
        initialConfig={
          isNewConfigSelected
            ? null // Для новой конфигурации передаем null, чтобы создать новую
            : selectedConfigId && selectedConfigExists
            ? configsData?.configs?.find((c) => c.id === selectedConfigId) ||
              (defaultConfig?.id === selectedConfigId ? defaultConfig : null)
            : null
        }
      />

    </Dialog>
  );
}

