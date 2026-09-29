import type { GetServerSideProps } from 'next'
import MagnetLanding from '../components/magnet/MagnetLanding'
import { isWebycitasFormRubro, type WebycitasFormRubro } from '../lib/magnet/demo-local'

interface Props {
  initialRubro: WebycitasFormRubro
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const raw = ctx.query.rubro
  const initialRubro = typeof raw === 'string' && isWebycitasFormRubro(raw) ? raw : 'barberia'
  return { props: { initialRubro } }
}

export default function HomePage({ initialRubro }: Props) {
  return <MagnetLanding initialRubro={initialRubro} />
}
