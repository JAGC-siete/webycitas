-- Plantilla y rubro Perfumería: vitrina boutique con pedido por WhatsApp.
-- ADD VALUE no puede usarse en la misma transacción; ningún INSERT aquí lo referencia.

ALTER TYPE public.site_template ADD VALUE IF NOT EXISTS 'perfumeria';

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_rubro_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_rubro_check CHECK (
    rubro = ANY (ARRAY[
      'barberia',
      'ferreteria',
      'cafeteria',
      'mercadito',
      'escuela',
      'otro',
      'papeleria',
      'supermercado',
      'spa',
      'clinica',
      'salon',
      'perfumeria'
    ])
  );
