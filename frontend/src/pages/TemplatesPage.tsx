/**
 * Страница управления шаблонами сообщений
 * 
 * Функциональность:
 * - Список шаблонов с фильтрацией и поиском
 * - Категории шаблонов в sidebar
 * - Создание/редактирование/удаление шаблонов
 * - Дублирование и перемещение шаблонов
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
  InputAdornment,
  Divider,
} from '@mui/material';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common/SelectStyles';
import { StyledButton, StyledTextField, CancelButton } from '@/components/common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import { useNavigate } from 'react-router-dom';
import {
  useTemplates,
  useTemplateCategories,
  useDeleteTemplate,
  useDeleteTemplateCategory,
} from '@/hooks/useTemplates';
import {
  TemplateCard,
  CreateCategoryDialog,
  EditCategoryDialog,
  DeleteTemplateDialog,
  DuplicateTemplateDialog,
  MoveToCategoryDialog,
  TemplatePreviewDialog,
} from '@/components/templates';
import type { Template, TemplateCategory, TemplateType, MessengerTarget, ListTemplatesQuery } from '@/types/template';

const ITEMS_PER_PAGE = 12;

export function TemplatesPage() {
  const navigate = useNavigate();
  
  // State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TemplateType | ''>('');
  const [messengerFilter, setMessengerFilter] = useState<MessengerTarget | ''>('');
  const [page, setPage] = useState(1);
  
  // Dialogs
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<TemplateCategory | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [duplicateTemplate, setDuplicateTemplate] = useState<Template | null>(null);
  const [moveTemplate, setMoveTemplate] = useState<Template | null>(null);

  // Queries
  const { data: categories, isLoading: categoriesLoading } = useTemplateCategories();
  
  const query: ListTemplatesQuery = useMemo(() => ({
    page,
    limit: ITEMS_PER_PAGE,
    search: searchQuery || undefined,
    categoryId: selectedCategoryId || undefined,
    type: typeFilter || undefined,
    messengerTarget: messengerFilter || undefined,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  }), [page, searchQuery, selectedCategoryId, typeFilter, messengerFilter]);

  const { data: templatesData, isLoading: templatesLoading, error: templatesError } = useTemplates(query);
  
  // Mutations
  const deleteTemplateMutation = useDeleteTemplate();
  const deleteCategoryMutation = useDeleteTemplateCategory();

  // Handlers
  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setPage(1);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleTypeFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || value === 'SINGLE' || value === 'MULTI') {
      setTypeFilter(value as TemplateType | '');
      setPage(1);
    }
  };

  const handleMessengerFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || value === 'WHATSAPP_ONLY' || value === 'TELEGRAM_ONLY' || value === 'UNIVERSAL') {
      setMessengerFilter(value as MessengerTarget | '');
      setPage(1);
    }
  };

  const handleEditTemplate = (template: Template) => {
    navigate(`/templates/${template.id}/edit`);
  };

  const handlePreviewTemplate = (template: Template) => {
    setPreviewTemplate(template);
  };

  const handleDuplicateTemplate = (template: Template) => {
    setDuplicateTemplate(template);
  };

  const handleMoveTemplate = (template: Template) => {
    setMoveTemplate(template);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    try {
      await deleteTemplateMutation.mutateAsync(deleteTemplateId);
      setDeleteTemplateId(null);
    } catch (error) {
      // Error will be shown via mutation error state
      // Логирование не требуется - React Query обрабатывает ошибки автоматически
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    try {
      await deleteCategoryMutation.mutateAsync(deleteCategoryId);
      setDeleteCategoryId(null);
      if (selectedCategoryId === deleteCategoryId) {
        setSelectedCategoryId(null);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };


  // Calculate counts
  const allTemplatesCount = templatesData?.pagination.total ?? 0;
  const categorizedCount = categories?.reduce((acc, cat) => acc + (cat._count?.templates ?? 0), 0) ?? 0;
  const uncategorizedCount = Math.max(0, allTemplatesCount - categorizedCount);

  return (
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
      <Box sx={{ display: 'flex', gap: 3, height: '100%' }}>
        {/* Sidebar - Categories */}
        <Paper
          sx={{
            width: 280,
            flexShrink: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ color: '#f5f5f5', fontWeight: 500, fontSize: '0.95rem' }}>
            Категории
          </Typography>
          <Tooltip title="Создать категорию">
            <IconButton
              size="small"
              onClick={() => setCreateCategoryOpen(true)}
              sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  color: '#fff',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <CreateNewFolderIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
        
        <List sx={{ flex: 1, overflow: 'auto', py: 1.5 }}>
          {/* All templates */}
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedCategoryId === null}
              onClick={() => handleCategorySelect(null)}
              sx={{
                mx: 1,
                borderRadius: '10px',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.25)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <AllInboxIcon sx={{ color: selectedCategoryId === null ? '#6366f1' : 'rgba(255, 255, 255, 0.6)' }} />
              </ListItemIcon>
              <ListItemText
                primary="Все шаблоны"
                sx={{ '& .MuiListItemText-primary': { color: '#f5f5f5', fontSize: '0.9rem' } }}
              />
              <Chip 
                label={allTemplatesCount} 
                size="small" 
                sx={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.12)', 
                  color: '#f5f5f5',
                  height: '22px',
                  fontSize: '0.75rem',
                }} 
              />
            </ListItemButton>
          </ListItem>

          {categoriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            categories?.map((category) => (
              <ListItem
                key={category.id}
                disablePadding
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pr: 0.5 }}>
                    <Tooltip title="Редактировать категорию">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditCategory(category);
                        }}
                        sx={{ 
                          color: 'rgba(255, 255, 255, 0.6)', 
                          '&:hover': { 
                            color: '#fff',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          } 
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Удалить категорию">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteCategoryId(category.id);
                        }}
                        sx={{ 
                          color: 'rgba(255, 255, 255, 0.5)', 
                          '&:hover': { 
                            color: '#f44336',
                            backgroundColor: 'rgba(244, 67, 54, 0.1)',
                          } 
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemButton
                  selected={selectedCategoryId === category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  sx={{
                    mx: 1,
                    borderRadius: '10px',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(99, 102, 241, 0.25)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {selectedCategoryId === category.id ? (
                      <FolderOpenIcon sx={{ color: category.color || '#6366f1' }} />
                    ) : (
                      <FolderIcon sx={{ color: category.color || 'rgba(255, 255, 255, 0.6)' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={category.name}
                    sx={{ '& .MuiListItemText-primary': { color: '#f5f5f5', fontSize: '0.9rem' } }}
                  />
                  <Chip
                    label={category._count?.templates ?? 0}
                    size="small"
                    sx={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.12)', 
                      color: '#f5f5f5', 
                      mr: 4,
                      height: '22px',
                      fontSize: '0.75rem',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))
          )}
        </List>
      </Paper>

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500, fontSize: '1.75rem' }}>
                Шаблоны
              </Typography>
              <StyledButton
                startIcon={<AddIcon />}
                onClick={() => navigate('/templates/create')}
              >
                Создать шаблон
              </StyledButton>
            </Box>

          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <StyledTextField
              placeholder="Поиск шаблонов..."
              value={searchQuery}
              onChange={handleSearch}
              size="small"
              sx={{ width: 320, flexShrink: 0 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.6)' }} />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={selectInputLabelStyles}>Тип</InputLabel>
              <StyledSelect
                value={typeFilter}
                label="Тип"
                onChange={handleTypeFilter}
                MenuProps={MenuProps}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="SINGLE">Одиночный</MenuItem>
                <MenuItem value="MULTI">Составной</MenuItem>
              </StyledSelect>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel sx={selectInputLabelStyles}>Мессенджер</InputLabel>
              <StyledSelect
                value={messengerFilter}
                label="Мессенджер"
                onChange={handleMessengerFilter}
                MenuProps={MenuProps}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="UNIVERSAL">Универсальный</MenuItem>
                <MenuItem value="WHATSAPP_ONLY">WhatsApp</MenuItem>
                <MenuItem value="TELEGRAM_ONLY">Telegram</MenuItem>
              </StyledSelect>
            </FormControl>
          </Box>
        </Box>

        {/* Templates Grid */}
        {templatesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : templatesError ? (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#f44336',
              border: '1px solid rgba(244, 67, 54, 0.2)',
            }}
          >
            {(templatesError as Error)?.message || 'Ошибка загрузки шаблонов'}
          </Alert>
        ) : templatesData?.data.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 1.5, fontWeight: 400 }}>
              Шаблоны не найдены
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 3 }}>
              {searchQuery || typeFilter || messengerFilter || selectedCategoryId
                ? 'Попробуйте изменить параметры поиска'
                : 'Создайте первый шаблон для начала работы'}
            </Typography>
            {!searchQuery && !typeFilter && !messengerFilter && !selectedCategoryId && (
              <StyledButton
                startIcon={<AddIcon />}
                onClick={() => navigate('/templates/create')}
              >
                Создать шаблон
              </StyledButton>
            )}
          </Box>
        ) : (
          <>
            <Grid container spacing={2} sx={{ flex: 1, overflow: 'auto' }}>
              {templatesData?.data.map((template) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                  <TemplateCard
                    template={template}
                    onEdit={handleEditTemplate}
                    onDelete={(t) => setDeleteTemplateId(t.id)}
                    onDuplicate={handleDuplicateTemplate}
                    onPreview={handlePreviewTemplate}
                    onMove={handleMoveTemplate}
                  />
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            {templatesData && templatesData.pagination.totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={templatesData.pagination.totalPages}
                  page={page}
                  onChange={(_, newPage) => setPage(newPage)}
                  color="primary"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-selected': {
                        backgroundColor: '#6366f1',
                        color: '#ffffff',
                        '&:hover': {
                          backgroundColor: '#5856eb',
                        },
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    },
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Dialogs */}
      <CreateCategoryDialog
        open={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
      />

      <EditCategoryDialog
        open={!!editCategory}
        category={editCategory}
        onClose={() => setEditCategory(null)}
      />

      {/* Delete Template Confirmation */}
      <DeleteTemplateDialog
        open={!!deleteTemplateId}
        templateName={templatesData?.data.find((t) => t.id === deleteTemplateId)?.name}
        onClose={() => {
          setDeleteTemplateId(null);
          deleteTemplateMutation.reset();
        }}
        onConfirm={handleDeleteTemplate}
        isLoading={deleteTemplateMutation.isPending}
        error={deleteTemplateMutation.error as Error | null}
      />

      <DuplicateTemplateDialog
        open={!!duplicateTemplate}
        templateId={duplicateTemplate?.id || null}
        defaultName={duplicateTemplate ? `${duplicateTemplate.name} (копия)` : ''}
        onClose={() => setDuplicateTemplate(null)}
        onSuccess={(id) => navigate(`/templates/${id}/edit`)}
      />

      <MoveToCategoryDialog
        open={!!moveTemplate}
        templateId={moveTemplate?.id || null}
        currentCategoryId={moveTemplate?.categoryId}
        onClose={() => setMoveTemplate(null)}
      />

      <TemplatePreviewDialog
        open={!!previewTemplate}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      />

        {/* Delete Category Confirmation */}
        <Dialog
          open={!!deleteCategoryId}
          onClose={() => setDeleteCategoryId(null)}
          PaperProps={dialogPaperProps}
        >
          <DialogTitle sx={{ color: '#fff', ...dialogTitleStyles }}>
            Удаление категории
          </DialogTitle>
          <DialogContent sx={dialogContentStyles}>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Вы уверены, что хотите удалить эту категорию?
              Шаблоны в этой категории будут перемещены в "Без категории".
            </Typography>
          </DialogContent>
          <DialogActions sx={dialogActionsStyles}>
            <CancelButton onClick={() => setDeleteCategoryId(null)}>
              Отмена
            </CancelButton>
            <StyledButton
              onClick={handleDeleteCategory}
              color="error"
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                'Удалить'
              )}
            </StyledButton>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

export default TemplatesPage;

