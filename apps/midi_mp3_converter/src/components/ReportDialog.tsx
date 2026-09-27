import { Button } from '@/components/ui/Button';
import type { Summary } from '@/types';
import { formatClock } from '@/utils/format';

interface ReportDialogProps {
    summary: Summary;
    onClose: () => void;
}

export function ReportDialog({ summary, onClose }: ReportDialogProps) {
    return (
        <div className='modal-backdrop'>
            <div className='modal bevel-out'>
                <div className='modal-title'>Relatório da conversão</div>
                <div className='modal-body'>
                    <div className='progress-line'>Concluídos: {summary.done}</div>
                    <div className='progress-line'>Ignorados: {summary.skipped}</div>
                    <div className='progress-line'>Com erro: {summary.failed}</div>
                    <div className='progress-line'>Tempo total: {formatClock(summary.elapsedMs / 1000)}</div>
                    {summary.canceled ? <div className='progress-line'>Cancelado pelo usuário</div> : null}
                    {summary.errors.length > 0 ? (
                        <fieldset className='group modal-errors'>
                            <legend>Erros</legend>
                            <div className='errors'>
                                {summary.errors.map((error) => (
                                    <div key={error.name} className='error-line'>
                                        <strong>{error.name}</strong>: {error.message}
                                    </div>
                                ))}
                            </div>
                        </fieldset>
                    ) : null}
                </div>
                <div className='modal-buttons'>
                    <Button onClick={onClose}>OK</Button>
                </div>
            </div>
        </div>
    );
}