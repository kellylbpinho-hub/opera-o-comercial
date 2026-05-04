-- Add conversation_status to contacts
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS conversation_status text NOT NULL DEFAULT 'NAO_ENVIADO';

CREATE INDEX IF NOT EXISTS idx_contacts_conversation_status ON public.contacts(conversation_status);

-- Validation trigger to restrict allowed values
CREATE OR REPLACE FUNCTION public.validate_conversation_status()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS validate_conversation_status_trigger ON public.contacts;
CREATE TRIGGER validate_conversation_status_trigger
BEFORE INSERT OR UPDATE OF conversation_status ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.validate_conversation_status();