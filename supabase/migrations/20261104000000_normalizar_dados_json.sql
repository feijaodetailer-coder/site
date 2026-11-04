-- Recupera JSON armazenado como string pelo driver, preservando campos e valores.
DO $$
DECLARE item record; decoded jsonb;
BEGIN
 FOR item IN SELECT id,data FROM public.workflow_records WHERE jsonb_typeof(data)='string' FOR UPDATE LOOP
  BEGIN
   decoded := (item.data #>> '{}')::jsonb;
   IF jsonb_typeof(decoded)='object' THEN
    UPDATE public.workflow_records SET data=decoded,version=version+1 WHERE id=item.id;
   END IF;
  EXCEPTION WHEN invalid_text_representation THEN
   RAISE NOTICE 'Registro % precisa de revisão manual',item.id;
  END;
 END LOOP;
END $$;
