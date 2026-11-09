import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Length } from 'class-validator';
export class CreateMonitorDto {

  @IsString()
  @Length(2, 100)
  name: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  url: string;

  @IsIn(['GET', 'POST', 'HEAD'])
  method: 'GET' | 'POST' | 'HEAD';

  @IsIn([30, 60, 300])
  intervalSeconds: 30 | 60 | 300;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
