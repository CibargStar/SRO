import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import type { UserCampaignLimits } from '@/types/campaign';

interface Props {
  rows: UserCampaignLimits[];
  onEdit: (row: UserCampaignLimits) => void;
}

export function UserCampaignLimitsTable({ rows, onEdit }: Props) {
  if (rows.length === 0) {
    return (
      <Paper sx={{ p: 4, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none', textAlign: 'center' }}>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          Нет данных о лимитах
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none', overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Email / UserId
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Активные кампании
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Шаблоны
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Категории
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Файл (MB)
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Хранилище (MB)
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Scheduled
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Universal
              </TableCell>
              <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow 
                key={row.id} 
                hover
                sx={{
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '& td': {
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  },
                }}
              >
                <TableCell>
                  <Typography sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                    {(row as any).user?.email ?? row.userId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {row.maxActiveCampaigns ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {row.maxTemplates ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {row.maxTemplateCategories ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {row.maxFileSizeMb ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {row.maxTotalStorageMb ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.allowScheduledCampaigns ? 'Да' : 'Нет'}
                    sx={{
                      backgroundColor: row.allowScheduledCampaigns 
                        ? 'rgba(76, 175, 80, 0.2)' 
                        : 'rgba(255, 255, 255, 0.08)',
                      color: row.allowScheduledCampaigns ? '#4caf50' : 'rgba(255, 255, 255, 0.5)',
                      border: '1px solid',
                      borderColor: row.allowScheduledCampaigns 
                        ? 'rgba(76, 175, 80, 0.4)' 
                        : 'rgba(255, 255, 255, 0.12)',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.allowUniversalCampaigns ? 'Да' : 'Нет'}
                    sx={{
                      backgroundColor: row.allowUniversalCampaigns 
                        ? 'rgba(76, 175, 80, 0.2)' 
                        : 'rgba(255, 255, 255, 0.08)',
                      color: row.allowUniversalCampaigns ? '#4caf50' : 'rgba(255, 255, 255, 0.5)',
                      border: '1px solid',
                      borderColor: row.allowUniversalCampaigns 
                        ? 'rgba(76, 175, 80, 0.4)' 
                        : 'rgba(255, 255, 255, 0.12)',
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Редактировать">
                    <IconButton 
                      onClick={() => onEdit(row)} 
                      size="small"
                      sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: '#f5f5f5',
                        },
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default UserCampaignLimitsTable;



