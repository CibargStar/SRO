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
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import type { UserCampaignLimits } from '@/types/campaign';

interface Props {
  rows: UserCampaignLimits[];
  onEdit: (row: UserCampaignLimits) => void;
}

export function UserCampaignLimitsTable({ rows, onEdit }: Props) {
  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email / UserId</TableCell>
              <TableCell>Активные кампании</TableCell>
              <TableCell>Шаблоны</TableCell>
              <TableCell>Категории</TableCell>
              <TableCell>Файл (MB)</TableCell>
              <TableCell>Хранилище (MB)</TableCell>
              <TableCell>Scheduled</TableCell>
              <TableCell>Universal</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{(row as any).user?.email ?? row.userId}</TableCell>
                <TableCell>{row.maxActiveCampaigns}</TableCell>
                <TableCell>{row.maxTemplates}</TableCell>
                <TableCell>{row.maxTemplateCategories}</TableCell>
                <TableCell>{row.maxFileSizeMb}</TableCell>
                <TableCell>{row.maxTotalStorageMb}</TableCell>
                <TableCell>{row.allowScheduledCampaigns ? 'Да' : 'Нет'}</TableCell>
                <TableCell>{row.allowUniversalCampaigns ? 'Да' : 'Нет'}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => onEdit(row)} size="small">
                    <EditIcon />
                  </IconButton>
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


