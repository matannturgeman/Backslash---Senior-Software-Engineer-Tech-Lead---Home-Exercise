import { ApiProperty } from '@nestjs/swagger';

export class VulnerabilityDto {
  @ApiProperty() file!: string;
  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] }) severity!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ required: false }) metadata?: Record<string, unknown>;
}

export class GraphNodeDto {
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['service', 'rds', 'sqs', 'sql'] }) kind!: string;
  @ApiProperty({ required: false }) publicExposed?: boolean;
  @ApiProperty({ type: [VulnerabilityDto], required: false }) vulnerabilities?: VulnerabilityDto[];
  @ApiProperty({ required: false }) language?: string;
  @ApiProperty({ required: false }) path?: string;
  @ApiProperty({ required: false }) metadata?: Record<string, unknown>;
}

export class GraphEdgeDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
}

export class GraphDto {
  @ApiProperty({ type: [GraphNodeDto] }) nodes!: GraphNodeDto[];
  @ApiProperty({ type: [GraphEdgeDto] }) edges!: GraphEdgeDto[];
}

export class FiltersDto {
  @ApiProperty({ type: [String], example: ['publicStart', 'sinkEnd', 'hasVulnerability'] })
  filters!: string[];
}
