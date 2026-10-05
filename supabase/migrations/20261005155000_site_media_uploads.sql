-- Site media: bucket público para landings + imagen opcional en inventario.

-- =====================================================================
-- 1) Bucket site-media (lectura pública; escritura vía service_role)
-- =====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-media',
  'site-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS site_media_public_read ON storage.objects;
CREATE POLICY site_media_public_read
  ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-media');

-- =====================================================================
-- 2) products.image_url
-- =====================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_image_url_format;

ALTER TABLE public.products
  ADD CONSTRAINT products_image_url_format CHECK (
    image_url IS NULL
    OR (
      length(trim(image_url)) BETWEEN 1 AND 500
      AND (
        image_url ~ '^https://'
        OR (image_url LIKE '/%' AND image_url NOT LIKE '//%')
      )
    )
  );

COMMENT ON COLUMN public.products.image_url IS
  'URL pública (https) o ruta interna (/…) de la foto del producto. Subida vía /api/suite/media/upload.';

GRANT INSERT (site_id, nombre, sku, precio, stock_minimo, image_url) ON public.products TO authenticated;
GRANT UPDATE (nombre, sku, precio, stock_minimo, image_url) ON public.products TO authenticated;
