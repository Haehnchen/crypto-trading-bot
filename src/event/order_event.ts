import { Order } from '../dict/order';

export class OrderEvent {
  constructor(
    public exchange: string,
    public order: Order
  ) {}
}
