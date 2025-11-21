import { IsUUID } from 'class-validator'

export class TransferLeadOwnerDto {
  @IsUUID()
  leadId!: string

  @IsUUID()
  newOwnerId!: string
}
