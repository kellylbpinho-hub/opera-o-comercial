CREATE OR REPLACE FUNCTION public.validate_conversation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_status NOT IN (
    'NAO_ENVIADO','ENVIADO','RESPONDIDO','EM_NEGOCIACAO',
    'AGENDADO','SEM_RESPOSTA','SEM_INTERESSE','PERDIDO','FECHADO'
  ) THEN
    RAISE EXCEPTION 'Invalid conversation_status: %', NEW.conversation_status;
  END IF;
  RETURN NEW;
END;
$$;