import type { GetServerSideProps } from 'next'
import { opsAdminLoginPath } from '../../lib/ops/paths'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const raw = ctx.query.redirect ?? ctx.query.next
  const next = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined
  return {
    redirect: {
      destination: opsAdminLoginPath(next),
      permanent: true,
    },
  }
}

export default function OpsLoginRedirect() {
  return null
}
