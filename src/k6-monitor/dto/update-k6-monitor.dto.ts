import { PartialType } from '@nestjs/mapped-types';
import { CreateK6MonitorDto } from './create-k6-monitor.dto';

export class UpdateK6MonitorDto extends PartialType(CreateK6MonitorDto) {}
