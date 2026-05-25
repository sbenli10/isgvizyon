import { TrainingCertificateTemplate } from "@/components/certificates/TrainingCertificateTemplate";
import type { CertificateFormValues, CertificateParticipantInput } from "@/types/certificates";

type Props = {
  form: CertificateFormValues;
  participant?: CertificateParticipantInput | null;
  className?: string;
};

export function CertificatePreviewCard(props: Props) {
  return <TrainingCertificateTemplate {...props} />;
}
