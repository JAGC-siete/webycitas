import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Allow', 'POST')
  return res.status(410).json({
    error: 'Este login ya no existe. Usá POST /api/auth/login.',
    login: '/app/login?redirect=/admin',
  })
}
