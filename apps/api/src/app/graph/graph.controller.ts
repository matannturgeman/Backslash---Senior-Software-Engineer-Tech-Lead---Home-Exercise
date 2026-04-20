import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Graph } from '@libs/shared-types';
import { AVAILABLE_FILTERS } from '../filters/filter.registry.js';
import { FiltersDto, GraphDto } from './graph.dto.js';
import { GraphService } from './graph.service.js';

@ApiTags('graph')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  @ApiOperation({ summary: 'Get the full microservices graph' })
  @ApiResponse({ status: 200, type: GraphDto })
  getGraph(): Promise<Graph> {
    return this.graphService.getFullGraph();
  }

  @Get('filters')
  @ApiOperation({ summary: 'List all available filter names' })
  @ApiResponse({ status: 200, type: FiltersDto })
  getFilters(): FiltersDto {
    return { filters: AVAILABLE_FILTERS };
  }

  @Get('routes')
  @ApiOperation({ summary: 'Get a filtered subgraph of routes' })
  @ApiQuery({
    name: 'filters',
    required: true,
    description: `Comma-separated filter names. Available: ${AVAILABLE_FILTERS.join(', ')}`,
    example: 'publicStart,sinkEnd',
  })
  @ApiResponse({ status: 200, type: GraphDto })
  @ApiResponse({ status: 400, description: 'Unknown or missing filter name' })
  getRoutes(@Query('filters') filtersParam: string): Promise<Graph> {
    if (!filtersParam?.trim()) {
      throw new BadRequestException(
        `Query param "filters" is required. Available: ${AVAILABLE_FILTERS.join(', ')}`,
      );
    }

    const filterNames = filtersParam
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    return this.graphService.getFilteredGraph(filterNames);
  }
}
