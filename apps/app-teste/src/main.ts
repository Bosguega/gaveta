import {
    AiApiError,
    createAiClient,
    DEFAULT_OLLAMA_BASE_URL,
    listModels as listGeminiModels,
    ollamaListModels,
    type ProviderName,
} from '@bosguega/ai-core'

type TestProvider = Extract<ProviderName, 'gemini' | 'ollama'>

const $ = (id: string) => document.getElementById(id)!

const providerSelect = $('providerSelect') as HTMLSelectElement
const apiKeyInput = $('apiKey') as HTMLInputElement
const baseUrlInput = $('baseUrl') as HTMLInputElement
const modelSelect = $('modelSelect') as HTMLSelectElement
const modelListContainer = $('modelListContainer')
const connectionStatus = $('connectionStatus')
const promptResult = $('promptResult')
const apiKeyField = $('apiKeyField')
const baseUrlField = $('baseUrlField')
const providerHint = $('providerHint')

const btnTestConnection = $('btnTestConnection') as HTMLButtonElement
const btnListModels = $('btnListModels') as HTMLButtonElement
const btnSendPrompt = $('btnSendPrompt') as HTMLButtonElement

function currentProvider(): TestProvider {
    return providerSelect.value === 'ollama' ? 'ollama' : 'gemini'
}

function currentBaseUrl(): string {
    return baseUrlInput.value.trim() || DEFAULT_OLLAMA_BASE_URL
}

function currentModel(): string {
    return modelSelect.value.trim()
}

function setStatus(type: 'success' | 'error' | 'loading', message: string) {
    connectionStatus.className = `status visible ${type}`
    connectionStatus.textContent = message
}

function clearStatus() {
    connectionStatus.className = 'status'
    connectionStatus.textContent = ''
}

function setButtonsLoading(loading: boolean) {
    btnTestConnection.disabled = loading
    btnListModels.disabled = loading
    btnSendPrompt.disabled = loading || !currentModel()
}

function setModelOptions(models: Array<{ id: string; name: string; size?: number }>) {
    modelSelect.innerHTML = models
        .map((model) => {
            const size = model.size ? ` (${formatBytes(model.size)})` : ''
            return `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name)}${size}</option>`
        })
        .join('')
    modelSelect.disabled = models.length === 0
    btnSendPrompt.disabled = models.length === 0
}

function resetModels(message: string) {
    modelSelect.innerHTML = `<option value="">${message}</option>`
    modelSelect.disabled = true
    btnSendPrompt.disabled = true
    modelListContainer.innerHTML = ''
    promptResult.textContent = ''
}

function escapeHtml(value: string): string {
    return value
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024
        unitIndex += 1
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function createClient() {
    const provider = currentProvider()
    const model = currentModel()

    if (!model) {
        throw new Error('Selecione um modelo primeiro.')
    }

    if (provider === 'ollama') {
        return createAiClient({
            provider,
            model,
            baseUrl: currentBaseUrl(),
            retry: false,
        })
    }

    const apiKey = apiKeyInput.value.trim()
    if (!apiKey) {
        throw new Error('Informe uma API Key primeiro.')
    }

    return createAiClient({
        provider,
        apiKey,
        model,
        retry: false,
    })
}

function renderProviderMode() {
    const provider = currentProvider()
    const isOllama = provider === 'ollama'

    apiKeyField.hidden = isOllama
    baseUrlField.hidden = !isOllama
    providerHint.textContent = isOllama
        ? 'Ollama usa o servidor local. Mantenha o app Ollama aberto e carregue modelos ja instalados.'
        : 'Gemini usa a API Key informada e lista modelos do Google AI Studio.'

    resetModels(isOllama ? '- clique em "Listar Modelos" -' : '- clique em "Listar Modelos" -')
    clearStatus()
}

async function handleError(err: unknown, fallback: string) {
    promptResult.textContent = ''
    if (err instanceof AiApiError) {
        setStatus('error', err.message)
    } else if (err instanceof Error) {
        setStatus('error', err.message)
    } else {
        setStatus('error', fallback)
    }
}

btnTestConnection.addEventListener('click', async () => {
    try {
        const provider = currentProvider()
        const client = createClient()

        setButtonsLoading(true)
        setStatus('loading', `Testando conexao com ${provider}...`)

        const result = await client.testConnection()

        if (result.success) {
            setStatus('success', `Conexao estabelecida usando "${currentModel()}".`)
        } else {
            setStatus('error', `Falha na conexao: ${result.error}`)
        }
    } catch (err) {
        await handleError(err, 'Erro desconhecido ao testar conexao.')
    } finally {
        setButtonsLoading(false)
    }
})

async function fetchAndPopulateModels() {
    const provider = currentProvider()

    if (provider === 'gemini' && !apiKeyInput.value.trim()) {
        setStatus('error', 'Informe uma API Key primeiro.')
        return
    }

    setButtonsLoading(true)
    setStatus('loading', 'Buscando modelos...')
    modelListContainer.innerHTML = ''

    try {
        const models = provider === 'ollama'
            ? await ollamaListModels(currentBaseUrl())
            : await listGeminiModels(apiKeyInput.value.trim())

        if (models.length === 0) {
            resetModels('- nenhum modelo encontrado -')
            setStatus('error', 'Nenhum modelo encontrado.')
            return
        }

        setModelOptions(models)
        modelListContainer.innerHTML = `
            <ul>
                ${models.map((model) => {
                    const size = 'size' in model && typeof model.size === 'number'
                        ? ` - ${formatBytes(model.size)}`
                        : ''
                    return `<li><code>${escapeHtml(model.id)}</code>${size}</li>`
                }).join('')}
            </ul>
        `

        setStatus('success', `${models.length} modelos encontrados.`)
    } catch (err) {
        await handleError(err, 'Erro desconhecido ao listar modelos.')
    } finally {
        setButtonsLoading(false)
    }
}

btnListModels.addEventListener('click', fetchAndPopulateModels)

btnSendPrompt.addEventListener('click', async () => {
    try {
        const client = createClient()

        setButtonsLoading(true)
        clearStatus()
        promptResult.textContent = 'Aguardando resposta...'

        const result = await client.generateText({
            userPrompt: 'Me responda em portugues: "Gaveta de Bagunca funcionando perfeitamente!"',
            temperature: 0.7,
            maxTokens: 256,
        })

        promptResult.textContent = result.text
        setStatus('success', `Resposta recebida de "${result.provider}" com "${result.model}".`)
    } catch (err) {
        await handleError(err, 'Erro desconhecido ao enviar prompt.')
    } finally {
        setButtonsLoading(false)
    }
})

providerSelect.addEventListener('change', () => {
    sessionStorage.setItem('ai_test_provider', currentProvider())
    renderProviderMode()
})

apiKeyInput.addEventListener('input', () => {
    sessionStorage.setItem('gemini_test_key', apiKeyInput.value.trim())
})

baseUrlInput.addEventListener('input', () => {
    sessionStorage.setItem('ollama_test_base_url', currentBaseUrl())
})

const savedProvider = sessionStorage.getItem('ai_test_provider')
if (savedProvider === 'ollama' || savedProvider === 'gemini') {
    providerSelect.value = savedProvider
}

apiKeyInput.value = sessionStorage.getItem('gemini_test_key') ?? ''
baseUrlInput.value = sessionStorage.getItem('ollama_test_base_url') ?? DEFAULT_OLLAMA_BASE_URL

renderProviderMode()
