import { PHASE_LABEL } from '@/types';

interface ProgressPanelProps {
    currentName: string | null;
    phase: string;
    itemPercent: number;
    batchPercent: number;
    doneCount: number;
    totalCount: number;
}

export function ProgressPanel({ currentName, phase, itemPercent, batchPercent, doneCount, totalCount }: ProgressPanelProps) {
    const clamped = Math.max(0, Math.min(100, batchPercent));
    const phaseText = phase ? PHASE_LABEL[phase] ?? phase : '';
    return (
        <fieldset className='group'>
            <legend>Progresso</legend>
            <div className='progress-line'>
                <span>
                    {currentName ? phaseText + ': ' + currentName : totalCount > 0 ? 'Pronto para converter' : 'Nenhum arquivo na lista'}
                </span>
                {currentName ? <span className='progress-item'>{Math.round(itemPercent)}% do arquivo</span> : null}
            </div>
            <div className='progress bevel-in'>
                <div className='progress-fill' style={{ width: clamped + '%' }} />
            </div>
            <div className='progress-line'>
                <span>
                    {doneCount} de {totalCount} arquivos
                </span>
                <span>{Math.round(clamped)}%</span>
            </div>
        </fieldset>
    );
}