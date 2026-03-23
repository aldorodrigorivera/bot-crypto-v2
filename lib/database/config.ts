import { initParse, Parse } from './client'

export async function getGridConfig(pair: string): Promise<{ gridLevels: number; gridRangePercent: number } | null> {
  initParse()
  const query = new Parse.Query('GridConfig')
  query.equalTo('pair', pair)
  const obj = await query.first()
  if (!obj) return null

  return {
    gridLevels: obj.get('gridLevels'),
    gridRangePercent: obj.get('gridRangePercent'),
  }
}

export async function saveGridConfig(pair: string, gridLevels: number, gridRangePercent: number): Promise<void> {
  initParse()
  const query = new Parse.Query('GridConfig')
  query.equalTo('pair', pair)

  let obj: Parse.Object | undefined = await query.first()
  if (!obj) {
    const GridConfigClass = Parse.Object.extend('GridConfig')
    obj = new GridConfigClass() as Parse.Object
    obj.set('pair', pair)
  }

  obj!.set('gridLevels', gridLevels)
  obj!.set('gridRangePercent', gridRangePercent)
  await obj!.save()
}
