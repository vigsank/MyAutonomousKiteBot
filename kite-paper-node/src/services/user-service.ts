/**
 * User Service — serves /user/profile and /user/margins.
 */

import type { MarginState } from '../types';
import { MarginService } from './margin-service';

export interface Profile {
  user_id: string;
  user_name: string;
  user_shortname: string;
  email: string;
  avatar_url: string | null;
  user_type: string;
  exchanges: string[];
  products: string[];
  order_types: string[];
  broker: string;
  meta: { demat_consent: string };
}

export class UserService {
  constructor(private marginService: MarginService) {}

  getProfile(): Profile {
    return {
      user_id: 'AB1234',
      user_name: 'Paper Trader',
      user_shortname: 'Paper',
      email: 'paper@kite-paper-node.local',
      avatar_url: null,
      user_type: 'investor',
      exchanges: ['NSE', 'BSE', 'MCX', 'NFO'],
      products: ['MIS', 'CNC', 'NRML'],
      order_types: ['MARKET', 'LIMIT', 'SL', 'SL-M'],
      broker: 'ZERODHA',
      meta: { demat_consent: 'consent' },
    };
  }

  getMargins(): MarginState {
    return this.marginService.getMargins();
  }
}
