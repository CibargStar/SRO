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
import { dialogPaperProps } from '@/components/common/DialogStyles';
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
  CreateTemplateDialog,
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
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
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

  const handleTypeFilter = (e: React.ChangeEvent<{ value: unknown }>) => {
    setTypeFilter(e.target.value as TemplateType | '');
    setPage(1);
  };

  const handleMessengerFilter = (e: React.ChangeEvent<{ value: unknown }>) => {
    setMessengerFilter(e.target.value as MessengerTarget | '');
    setPage(1);
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
      // Error handled by mutation
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

  const handleTemplateCreated = (templateId: string) => {
    navigate(`/templates/${templateId}/edit`);
  };

  // Calculate counts
  const allTemplatesCount = templatesData?.pagination.total ?? 0;
  const uncategorizedCount = categories?.reduce((acc, cat) => acc - (cat._count?.templates ?? 0), allTemplatesCount) ?? 0;

  return (
    <Box sx={{ display: 'flex', height: '100%', gap: 3 }}>
      {/* Sidebar - Categories */}
      <Paper
        sx={{
          width: 280,
          flexShrink: 0,
          backgroundColor: 'rgba(30, 30, 30, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 500 }}>
            Категории
          </Typography>
          <Tooltip title="Создать категорию">
            <IconButton
              size="small"
              onClick={() => setCreateCategoryOpen(true)}
              sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
            >
              <CreateNewFolderIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
        
        <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
          {/* All templates */}
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedCategoryId === null}
              onClick={() => handleCategorySelect(null)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <AllInboxIcon sx={{ color: selectedCategoryId === null ? '#6366f1' : 'rgba(255, 255, 255, 0.5)' }} />
              </ListItemIcon>
              <ListItemText
                primary="Все шаблоны"
                sx={{ '& .MuiListItemText-primary': { color: '#fff' } }}
              />
              <Chip label={allTemplatesCount} size="small" sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#fff' }} />
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
                        sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: '#fff' } }}
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
                        sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: '#f44336' } }}
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
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      '&:hover': {
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {selectedCategoryId === category.id ? (
                      <FolderOpenIcon sx={{ color: category.color || '#6366f1' }} />
                    ) : (
                      <FolderIcon sx={{ color: category.color || 'rgba(255, 255, 255, 0.5)' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={category.name}
                    sx={{ '& .MuiListItemText-primary': { color: '#fff' } }}
                  />
                  <Chip
                    label={category._count?.templates ?? 0}
                    size="small"
                    sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', mr: 4 }}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#ffffff' }}>
              Шаблоны сообщений
            </Typography>
            <StyledButton
              startIcon={<AddIcon />}
              onClick={() => setCreateTemplateOpen(true)}
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
              sx={{ width: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={selectInputLabelStyles}>Тип</InputLabel>
              <StyledSelect
                value={typeFilter}
                label="Тип"
                onChange={handleTypeFilter as any}
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
                onChange={handleMessengerFilter as any}
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
          <Alert severity="error" sx={{ mb: 2 }}>
            {(templatesError as Error)?.message || 'Ошибка загрузки шаблонов'}
          </Alert>
        ) : templatesData?.data.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 2 }}>
              Шаблоны не найдены
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.3)', mb: 3 }}>
              {searchQuery || typeFilter || messengerFilter || selectedCategoryId
                ? 'Попробуйте изменить параметры поиска'
                : 'Создайте первый шаблон для начала работы'}
            </Typography>
            {!searchQuery && !typeFilter && !messengerFilter && (
              <StyledButton
                startIcon={<AddIcon />}
                onClick={() => setCreateTemplateOpen(true)}
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
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={templatesData.pagination.totalPages}
                  page={page}
                  onChange={(_, newPage) => setPage(newPage)}
                  color="primary"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: '#ffffff',
                      '&.Mui-selected': {
                        backgroundColor: '#6366f1',
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

      <CreateTemplateDialog
        open={createTemplateOpen}
        onClose={() => setCreateTemplateOpen(false)}
        defaultCategoryId={selectedCategoryId}
        onSuccess={handleTemplateCreated}
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
        onClose={() => setDeleteTemplateId(null)}
        onConfirm={handleDeleteTemplate}
        isLoading={deleteTemplateMutation.isPending}
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
        <DialogTitle sx={{ color: '#fff' }}>Удаление категории</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы уверены, что хотите удалить эту категорию?
            Шаблоны в этой категории будут перемещены в "Без категории".
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <CancelButton onClick={() => setDeleteCategoryId(null)}>
            Отмена
          </CancelButton>
          <Button
            onClick={handleDeleteCategory}
            color="error"
            variant="contained"
            disabled={deleteCategoryMutation.isPending}
          >
            {deleteCategoryMutation.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              'Удалить'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TemplatesPage;

