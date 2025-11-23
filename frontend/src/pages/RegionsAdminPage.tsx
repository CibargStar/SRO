/**
 * Страница админки регионов
 * 
 * Предоставляет интерфейс для управления регионами (только для ROOT):
 * - Список регионов
 * - Создание региона
 * - Редактирование региона
 * - Удаление региона (с защитой от удаления регионов с клиентами)
 * - Детальная статистика по клиентам в регионах с переключением пользователя
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import { StyledButton, CancelButton } from '@/components/common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import AddIcon from '@mui/icons-material/Add';
import { useRegions, useDeleteRegion } from '@/hooks/useRegions';
import { RegionTable } from '@/components/RegionTable';
import { CreateRegionDialog } from '@/components/CreateRegionDialog';
import { EditRegionDialog } from '@/components/EditRegionDialog';
import { RegionStatistics } from '@/components/RegionStatistics';
import type { Region } from '@/types';

/**
 * Вкладки страницы
 */
type TabValue = 'list' | 'statistics';

/**
 * Страница админки регионов
 * 
 * Требует ROOT роль. Frontend проверяет через RootRoute,
 * backend проверяет через middleware requireRoot.
 */
export function RegionsAdminPage() {
  const { data: regions, isLoading, error } = useRegions();
  const deleteRegionMutation = useDeleteRegion();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabValue>('list');

  const handleEdit = (region: Region) => {
    setSelectedRegion(region);
    setEditDialogOpen(true);
  };

  const handleDelete = (region: Region) => {
    setSelectedRegion(region);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedRegion) {
      const totalClients = selectedRegion._count?.clients || 0;
      
      // Защита от удаления региона с клиентами
      if (totalClients > 0) {
        return; // Не должно произойти, т.к. кнопка удаления отключена, но на всякий случай
      }

      deleteRegionMutation.mutate(selectedRegion.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setSelectedRegion(null);
        },
      });
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedRegion(null);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedRegion(null);
  };

  // Ошибка загрузки
  const errorMessage = error ? 'Не удалось загрузить регионы' : null;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            color: '#f5f5f5',
            fontWeight: 500,
          }}
        >
          Управление регионами
        </Typography>
        <StyledButton
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Создать регион
        </StyledButton>
      </Box>

      {/* Вкладки */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.1)', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => {
            setActiveTab(value as TabValue);
            // При переключении на статистику, если не выбран пользователь, выбираем первого
            if (value === 'statistics' && !selectedUserId) {
              // Это будет обработано в RegionStatistics
            }
          }}
          sx={{
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              '&.Mui-selected': {
                color: '#ffffff',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#ffffff',
            },
          }}
        >
          <Tab label="Список регионов" value="list" />
          <Tab label="Статистика" value="statistics" />
        </Tabs>
      </Box>

      {errorMessage && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#ffffff',
            border: 'none',
          }}
        >
          {errorMessage}
        </Alert>
      )}

      {/* Контент вкладок */}
      {activeTab === 'list' && (
        <>
          {isLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
              <CircularProgress sx={{ color: '#f5f5f5' }} />
            </Box>
          ) : regions ? (
            <RegionTable
              regions={regions}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <Alert
              severity="info"
              sx={{
                borderRadius: '12px',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              Не удалось загрузить регионы
            </Alert>
          )}
        </>
      )}

      {activeTab === 'statistics' && (
        <RegionStatistics
          selectedUserId={selectedUserId}
          onUserChange={setSelectedUserId}
        />
      )}

      {/* Диалоги */}
      <CreateRegionDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <EditRegionDialog
        open={editDialogOpen}
        region={selectedRegion}
        onClose={handleCloseEditDialog}
      />

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        disableEnforceFocus
        PaperProps={dialogPaperProps}
      >
        <DialogTitle sx={{ color: '#f5f5f5' }}>Удаление региона</DialogTitle>
        <DialogContent>
          {selectedRegion && (
            <>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
                Вы уверены, что хотите удалить регион <strong>{selectedRegion.name}</strong>?
              </Typography>
              {selectedRegion._count?.clients && selectedRegion._count.clients > 0 ? (
                <Alert
                  severity="error"
                  sx={{
                    borderRadius: '12px',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  Невозможно удалить регион. В регионе числится {selectedRegion._count.clients} клиент(ов).
                  Сначала удалите или переместите всех клиентов из этого региона.
                </Alert>
              ) : (
                <Alert
                  severity="warning"
                  sx={{
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  Это действие нельзя отменить.
                </Alert>
              )}
            </>
          )}
          {deleteRegionMutation.error && (
            <Alert
              severity="error"
              sx={{
                mt: 2,
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              {deleteRegionMutation.error instanceof Error
                ? deleteRegionMutation.error.message
                : 'Не удалось удалить регион'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleCloseDeleteDialog} disabled={deleteRegionMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            onClick={handleConfirmDelete}
            disabled={
              deleteRegionMutation.isPending ||
              (selectedRegion?._count?.clients || 0) > 0
            }
            sx={{
              backgroundColor: 'rgba(244, 67, 54, 0.2)',
              color: '#f44336',
              '&:hover': {
                backgroundColor: 'rgba(244, 67, 54, 0.3)',
              },
            }}
          >
            {deleteRegionMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} sx={{ color: '#f44336' }} />
            ) : (
              'Удалить'
            )}
          </StyledButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

