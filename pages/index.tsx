import type { GetServerSideProps } from 'next'
import MagnetLanding from '../components/magnet/MagnetLanding'
import {
  isWebycitasFormRubro,
  parseLeadRef,
  type WebycitasFormRubro,
  type WebycitasLeadRef,
} from '../lib/magnet/demo-local'

interface Props {
  initialRubro: WebycitasFormRubro
  leadRef: WebycitasLeadRef | null
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const raw = ctx.query.rubro
  const initialRubro = typeof raw === 'string' && isWebycitasFormRubro(raw) ? raw : 'barberia'
  return { props: { initialRubro, leadRef: parseLeadRef(ctx.query.ref) ?? null } }
}

export default function HomePage({ initialRubro, leadRef }: Props) {
  return <MagnetLanding initialRubro={initialRubro} leadRef={leadRef ?? undefined} />
}
