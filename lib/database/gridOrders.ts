import { initParse, Parse } from './client'
import type { GridOrder, OrderSide, OrderStatus } from '../types'

function toGridOrder(obj: Parse.Object): GridOrder {
  return {
    objectId: obj.id,
    orderId: obj.get('orderId'),
    level: obj.get('level'),
    side: obj.get('side') as OrderSide,
    price: obj.get('price'),
    amount: obj.get('amount'),
    status: obj.get('status') as OrderStatus,
    filledAt: obj.get('filledAt'),
    pairedOrderId: obj.get('pairedOrderId'),
  }
}

export async function saveGridOrder(order: GridOrder): Promise<GridOrder> {
  initParse()
  const GridOrderClass = Parse.Object.extend('GridOrder')
  const obj = new GridOrderClass()

  obj.set('orderId', order.orderId)
  obj.set('level', order.level)
  obj.set('side', order.side)
  obj.set('price', order.price)
  obj.set('amount', order.amount)
  obj.set('status', order.status)
  if (order.filledAt) obj.set('filledAt', order.filledAt)
  if (order.pairedOrderId) obj.set('pairedOrderId', order.pairedOrderId)

  await obj.save()
  return toGridOrder(obj)
}

export async function updateGridOrderStatus(
  orderId: string,
  status: OrderStatus,
  pairedOrderId?: string
): Promise<void> {
  initParse()
  const query = new Parse.Query('GridOrder')
  query.equalTo('orderId', orderId)
  const obj = await query.first()
  if (!obj) return

  obj.set('status', status)
  if (status === 'filled') obj.set('filledAt', new Date())
  if (pairedOrderId) obj.set('pairedOrderId', pairedOrderId)
  await obj.save()
}

export async function getActiveGridOrders(): Promise<GridOrder[]> {
  initParse()
  const query = new Parse.Query('GridOrder')
  query.equalTo('status', 'open')
  query.limit(1000)
  const results = await query.find()
  return results.map(toGridOrder)
}

export async function clearAllGridOrders(): Promise<void> {
  initParse()
  const query = new Parse.Query('GridOrder')
  query.limit(1000)
  const results = await query.find()
  await Parse.Object.destroyAll(results)
}
