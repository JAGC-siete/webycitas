import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  groupAgendaByDay,
  hondurasLocalToIso,
  shiftDay,
  summarizeSchedules,
  validateAppointmentForm,
  validateBlockForm,
  validateServiceForm,
} from '../lib/suite/agenda'
import { buildActivityFeed } from '../lib/suite/activity'

describe('suite agenda helpers', () => {
  it('converts a Honduras local datetime to ISO', () => {
    assert.equal(hondurasLocalToIso('2026-10-09T09:30'), '2026-10-09T15:30:00.000Z')
  })

  it('shifts days across month and year ends', () => {
    assert.equal(shiftDay('2026-10-31', 1), '2026-11-01')
    assert.equal(shiftDay('2026-01-01', -1), '2025-12-31')
    assert.equal(shiftDay('2026-10-09', 7), '2026-10-16')
  })

  it('groups appointments and blocks by Honduras day, in time order', () => {
    const appointments = [
      { id: 'a2', starts_at: '2026-10-10T16:00:00.000Z', ends_at: '2026-10-10T16:30:00.000Z' },
      { id: 'a1', starts_at: '2026-10-09T15:30:00.000Z', ends_at: '2026-10-09T16:00:00.000Z' },
      // 23:30 en Honduras del día 9, ya es día 10 en UTC.
      { id: 'a3', starts_at: '2026-10-10T05:30:00.000Z', ends_at: '2026-10-10T06:00:00.000Z' },
    ]
    const blocks = [{ id: 'b1', starts_at: '2026-10-09T18:00:00.000Z', ends_at: '2026-10-09T19:00:00.000Z' }]
    const days = groupAgendaByDay(appointments, blocks)
    assert.deepEqual(
      days.map((d) => [d.day, d.entries.map((e) => e.item.id)]),
      [
        ['2026-10-09', ['a1', 'b1', 'a3']],
        ['2026-10-10', ['a2']],
      ]
    )
    assert.equal(days[0].entries[1].kind, 'block')
  })

  it('validates the appointment form in plain words', () => {
    assert.deepEqual(
      validateAppointmentForm({ customer_name: 'Ana', customer_phone: '', starts_at: '2026-10-09T09:00' }),
      {}
    )
    const errors = validateAppointmentForm({ customer_name: ' ', customer_phone: '123', starts_at: '' })
    assert.ok(errors.customer_name)
    assert.ok(errors.customer_phone)
    assert.ok(errors.starts_at)
    assert.deepEqual(
      validateAppointmentForm({ customer_name: 'Ana', customer_phone: '+504 9876-1004', starts_at: '2026-10-09T09:00' }),
      {}
    )
  })

  it('skips contact checks when scheduling an inquiry', () => {
    assert.deepEqual(
      validateAppointmentForm({ customer_name: '', customer_phone: '12', starts_at: '2026-10-09T10:00' }, { contact: false }),
      {}
    )
  })

  it('rejects a block that ends before it starts', () => {
    assert.deepEqual(validateBlockForm({ starts_at: '2026-10-09T12:00', ends_at: '2026-10-09T13:00' }), {})
    assert.ok(validateBlockForm({ starts_at: '2026-10-09T13:00', ends_at: '2026-10-09T12:00' }).ends_at)
  })

  it('summarizes staff schedules in plain words', () => {
    const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: '08:00:00', end_time: '17:00:00' }))
    assert.equal(
      summarizeSchedules([...weekdays, { weekday: 6, start_time: '08:00:00', end_time: '14:00:00' }]),
      'Lun a Vie 08:00–17:00 · Sáb 08:00–14:00'
    )
    assert.equal(summarizeSchedules([]), 'Sin horario')
    assert.equal(
      summarizeSchedules([
        { weekday: 1, start_time: '08:00', end_time: '12:00' },
        { weekday: 3, start_time: '08:00', end_time: '12:00' },
      ]),
      'Lun 08:00–12:00 · Mié 08:00–12:00'
    )
  })

  it('validates services with the database duration range', () => {
    assert.deepEqual(validateServiceForm({ name: 'Corte', price: '150', duration: '30' }), {})
    assert.deepEqual(validateServiceForm({ name: 'Asesoría', price: '0', duration: '15' }), {})
    const errors = validateServiceForm({ name: '', price: 'abc', duration: '2' })
    assert.deepEqual(Object.keys(errors).sort(), ['duration', 'name', 'price'])
  })
})

describe('suite activity feed', () => {
  it('merges inquiries and cancellations, newest first, without duplicates', () => {
    const feed = buildActivityFeed(
      [
        { type: 'inquiry', id: 'i1', title: 'Nueva solicitud: Ana', at: '2026-10-09T15:00:00.000Z' },
        { type: 'cancellation', id: 'c1', title: 'Cancelación: Luis', at: '2026-10-09T16:00:00.000Z' },
      ],
      [
        { id: 'i1', full_name: 'Ana', created_at: '2026-10-09T15:00:00.000Z' },
        { id: 'i0', full_name: 'Beto', created_at: '2026-10-01T15:00:00.000Z' },
      ]
    )
    assert.deepEqual(
      feed.map((item) => [item.kind, item.title]),
      [
        ['cancellation', 'Cita cancelada: Luis'],
        ['inquiry', 'Te escribió Ana'],
        ['inquiry', 'Te escribió Beto'],
      ]
    )
  })
})
