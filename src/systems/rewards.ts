import { bus } from '../engine/eventBus'
import { updatePlayer } from './player'

export interface RewardGrant {
  lingshi: number
  exp_qi: number
  items: string[]
}

/** 奖励适配器：成长/背包系统未接入前统一走事件，后续只需替换本文件实现 */
export function grantRewards(rewards: RewardGrant): void {
  for (const itemId of rewards.items) bus.emit('item:acquired', { itemId })
  if (rewards.exp_qi > 0) bus.emit('reward:exp', { expQi: rewards.exp_qi })
  if (rewards.lingshi > 0) updatePlayer((p) => ({ ...p, lingshi: p.lingshi + rewards.lingshi }))
}
