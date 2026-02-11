import { Controller, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { QueryWeeklyReportDto } from './dto/query-weekly-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('weekly')
  async generateWeeklyReport(
    @Query() query: QueryWeeklyReportDto,
    @Res() res: Response
  ) {
    const pdfBuffer = await this.reportsService.generateWeeklyReport(
      query.from,
      query.to
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-semanal-${query.from}-${query.to}.pdf"`
    );
    res.send(pdfBuffer);
  }
}

