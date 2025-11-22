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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useImportClients } from '@/hooks/useImport';
import { useClientGroups, useClientGroup } from '@/hooks/useClientGroups';
import { ClientGroupSelector } from './ClientGroupSelector';
import { CreateClientGroupDialog } from './CreateClientGroupDialog';
import type { ImportClientsResponse } from '@/utils/api';

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
}

export function ImportClientsDialog({ open, onClose }: ImportClientsDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [groupId, setGroupId] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportClientsResponse | null>(null);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: groups = [], isLoading: groupsLoading } = useClientGroups();
  const { data: selectedGroup } = useClientGroup(groupId);
  const importMutation = useImportClients();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Проверка формата файла
      const allowedExtensions = ['.xlsx', '.xls', '.csv'];
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(ext)) {
        alert('Неподдерживаемый формат файла. Разрешены: .xlsx, .xls, .csv');
        return;
      }
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

    // Проверка: если группа не пустая, показываем предупреждение
    const clientsCount = selectedGroup?._count?.clients ?? 0;
    if (clientsCount > 0) {
      setWarningDialogOpen(true);
      return;
    }

    // Если группа пустая - импортируем сразу
    await performImport();
  };

  const performImport = async () => {
    if (!selectedFile || !groupId) {
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        groupId,
        file: selectedFile,
      });
      setImportResult(result);
      setWarningDialogOpen(false);
    } catch (error) {
      // Ошибка обрабатывается через mutation.error
      setWarningDialogOpen(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setGroupId('');
    setImportResult(null);
    setCreateGroupDialogOpen(false);
    setWarningDialogOpen(false);
    importMutation.reset();
    onClose();
  };

  const handleGroupCreated = (newGroupId: string) => {
    setGroupId(newGroupId);
    setCreateGroupDialogOpen(false);
  };

  const isLoading = importMutation.isPending;
  const error = importMutation.error;
  const hasGroups = groups.length > 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus
      PaperProps={{ sx: { backgroundColor: '#212121', borderRadius: '12px' } }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Импорт клиентов из Excel
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Выбор группы (скрывается после завершения импорта) */}
          {!importResult && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
                Выберите группу для импорта:
              </Typography>
              {!groupsLoading && !hasGroups ? (
                <Alert 
                  severity="warning" 
                  sx={{ 
                    mb: 2, 
                    borderRadius: '12px', 
                    backgroundColor: 'rgba(255, 152, 0, 0.1)', 
                    color: '#ffffff', 
                    border: 'none' 
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                    У вас нет групп клиентов. Создайте группу перед импортом.
                  </Typography>
                  <StyledButton
                    size="small"
                    onClick={() => setCreateGroupDialogOpen(true)}
                    sx={{ mt: 1 }}
                  >
                    Создать группу
                  </StyledButton>
                </Alert>
              ) : (
                <ClientGroupSelector
                  value={groupId || null}
                  onChange={(val) => setGroupId(val || '')}
                  required
                  disabled={isLoading}
                />
              )}
            </Box>
          )}

          {/* Загрузка файла */}
          {!importResult && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
                Выберите Excel файл (XLSX, XLS, CSV):
              </Typography>
              <UploadArea onClick={handleUploadClick}>
                <CloudUploadIcon sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.5)', mb: 2 }} />
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                  {selectedFile ? selectedFile.name : 'Нажмите для выбора файла'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Поддерживаемые форматы: .xlsx, .xls, .csv
                </Typography>
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
              <LinearProgress sx={{ borderRadius: '12px', height: 8 }} />
            </Box>
          )}

          {/* Ошибка */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                borderRadius: '12px', 
                backgroundColor: 'rgba(244, 67, 54, 0.1)', 
                color: '#ffffff', 
                border: 'none' 
              }}
            >
              {error instanceof Error ? error.message : 'Произошла ошибка при импорте'}
            </Alert>
          )}

          {/* Результаты импорта */}
          {importResult && (
            <StyledPaper>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {importResult.success ? (
                  <CheckCircleIcon sx={{ color: '#4caf50' }} />
                ) : (
                  <ErrorIcon sx={{ color: '#f44336' }} />
                )}
                <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                  {importResult.success ? 'Импорт завершен успешно' : 'Импорт завершен с ошибками'}
                </Typography>
              </Box>

              {/* Статистика */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip
                  label={`Всего: ${importResult.statistics.total}`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                    color: '#ffffff',
                    fontWeight: 500,
                    '& .MuiChip-label': {
                      color: '#ffffff',
                    },
                  }}
                />
                <Chip
                  label={`Создано: ${importResult.statistics.created}`}
                  color="success"
                  size="small"
                />
                <Chip
                  label={`Обновлено: ${importResult.statistics.updated}`}
                  color="info"
                  size="small"
                />
                <Chip
                  label={`Пропущено: ${importResult.statistics.skipped}`}
                  color="warning"
                  size="small"
                />
                {importResult.statistics.errors > 0 && (
                  <Chip
                    label={`Ошибок: ${importResult.statistics.errors}`}
                    color="error"
                    size="small"
                  />
                )}
                {importResult.statistics.regionsCreated > 0 && (
                  <Chip
                    label={`Регионов создано: ${importResult.statistics.regionsCreated}`}
                    color="secondary"
                    size="small"
                  />
                )}
              </Box>

              {/* Детали ошибок */}
              {importResult.errors && importResult.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: '#f5f5f5', fontWeight: 500 }}>
                    Ошибки импорта:
                  </Typography>
                  <List dense>
                    {importResult.errors.slice(0, 10).map((error, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemText
                            primary={`Строка ${error.rowNumber}: ${error.message}`}
                            secondary={
                              error.data
                                ? `Имя: ${error.data.name || 'не указано'}, Телефон: ${error.data.phone}, Регион: ${error.data.region}`
                                : undefined
                            }
                            primaryTypographyProps={{ 
                              sx: { fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)' } 
                            }}
                            secondaryTypographyProps={{ 
                              sx: { fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' } 
                            }}
                          />
                        </ListItem>
                        {index < importResult.errors!.length - 1 && (
                          <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                        )}
                      </React.Fragment>
                    ))}
                    {importResult.errors.length > 10 && (
                      <ListItem>
                        <ListItemText
                          primary={`... и еще ${importResult.errors.length - 10} ошибок`}
                          primaryTypographyProps={{ 
                            sx: { fontSize: '0.875rem', fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.7)' } 
                          }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}
            </StyledPaper>
          )}

          {/* Информация о формате файла */}
          {!importResult && (
            <Alert 
              severity="info" 
              sx={{ 
                borderRadius: '12px', 
                backgroundColor: 'rgba(33, 150, 243, 0.1)', 
                color: '#ffffff', 
                border: 'none' 
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5, color: '#ffffff' }}>
                Требования к файлу:
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                Файл должен содержать следующие колонки:
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>
                    <strong>name</strong> (или: имя, фио, full name, полное имя, контакт) - Полное ФИО
                  </li>
                  <li>
                    <strong>phone</strong> (или: телефон, tel, mobile, мобильный, номер) - Номера телефонов
                  </li>
                  <li>
                    <strong>region</strong> (или: регион, область, город, city, area) - Название региона
                  </li>
                </ul>
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <CancelButton onClick={handleClose} disabled={isLoading}>
          {importResult ? 'Закрыть' : 'Отмена'}
        </CancelButton>
        {!importResult && (
          <StyledButton
            onClick={handleImport}
            disabled={!selectedFile || !groupId || isLoading || !hasGroups}
            startIcon={isLoading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          >
            Импортировать
          </StyledButton>
        )}
      </DialogActions>

      {/* Диалог создания группы */}
      <CreateClientGroupDialog
        open={createGroupDialogOpen}
        onClose={() => setCreateGroupDialogOpen(false)}
        onSuccess={handleGroupCreated}
      />

      {/* Диалог предупреждения о дедупликации */}
      <Dialog
        open={warningDialogOpen}
        onClose={() => setWarningDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { backgroundColor: '#212121', borderRadius: '12px' } }}
      >
        <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Внимание!
          </Typography>
        </Box>

        <DialogContent sx={{ px: 3, pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.9)' }}>
            При загрузке базы клиентов в группу, в которой уже имеются контакты будет включен автоматический поиск дубликатов.
          </Typography>

          <Typography variant="body2" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
            Логика обработки дубликатов:
          </Typography>
          
          <Box component="ul" sx={{ pl: 2, mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
            <li style={{ marginBottom: '8px' }}>
              <Typography variant="body2" component="span">
                <strong>Поиск дубликатов</strong> выполняется по номерам телефонов среди всех клиентов владельца группы (не только в выбранной группе).
              </Typography>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <Typography variant="body2" component="span">
                Если найден клиент с таким же телефоном:
              </Typography>
              <Box component="ul" sx={{ pl: 2, mt: 0.5 }}>
                <li>
                  <Typography variant="body2" component="span">
                    У существующего клиента нет ФИО, а в импорте есть → <strong>обновляется ФИО</strong> существующего клиента
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" component="span">
                    Есть новые номера телефонов → <strong>добавляются</strong> к существующему клиенту
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" component="span">
                    Полное совпадение (телефоны и ФИО) → <strong>пропускается</strong> (дубликат)
                  </Typography>
                </li>
              </Box>
            </li>
            <li>
              <Typography variant="body2" component="span">
                Если клиент не найден → <strong>создается новый</strong> клиент
              </Typography>
            </li>
          </Box>

          <Alert 
            severity="info" 
            sx={{ 
              borderRadius: '12px', 
              backgroundColor: 'rgba(33, 150, 243, 0.1)', 
              color: '#ffffff', 
              border: 'none',
              mt: 2
            }}
          >
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Вы можете отменить импорт, если не хотите выполнять дедупликацию.
            </Typography>
          </Alert>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <CancelButton onClick={() => setWarningDialogOpen(false)}>
            Отмена
          </CancelButton>
          <StyledButton
            onClick={performImport}
            disabled={importMutation.isPending}
            startIcon={importMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            Продолжить импорт
          </StyledButton>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

