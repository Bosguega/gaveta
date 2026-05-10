import { generateText, listModels, testConnection, AiApiError } from '@bosguega/ai-core'

// DOM refs
const $ = (id: string) => document.getElementById(id)!

const apiKeyInput = $('apiKey') as HTMLInputElement
const modelSelect = $('modelSelect') as HTMLSelectElement
const modelListContainer = $('modelListContainer')
const connectionStatus = $('connectionStatus')
const promptResult = $('promptResult')

const btnTestConnection = $('btnTestConnection') as HTMLButtonElement
const btnListModels = $('btnListModels') as HTMLButtonElement
const btnSendPrompt = $('btnSendPrompt') as HTMLButtonElement

// ------ Helpers ------

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
    btnSendPrompt.disabled = loading || modelSelect.disabled || !modelSelect.value
}

// ------ Testar Conexão ------

btnTestConnection.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim()
    if (!key) {
        setStatus('error', 'Informe uma API Key primeiro.')
        return
    }

    setButtonsLoading(true)
    setStatus('loading', 'Testando conexão com Gemini...')

    const model = modelSelect.value || 'gemini-2.0-flash'

    const result = await testConnection(key, model)

    setButtonsLoading(false)

    if (result.success) {
        setStatus('success', `✅ Conexão estabelecida com sucesso usando "${model}"!`)
    } else {
        setStatus('error', `❌ Falha na conexão: ${result.error}`)
    }
})

// ------ Listar Modelos ------

async function fetchAndPopulateModels() {
    const key = apiKeyInput.value.trim()
    if (!key) {
        setStatus('error', 'Informe uma API Key primeiro.')
        return
    }

    setButtonsLoading(true)
    setStatus('loading', 'Buscando modelos...')
    modelListContainer.innerHTML = ''

    try {
        const models = await listModels(key)

        setButtonsLoading(false)

        if (models.length === 0) {
            setStatus('error', 'Nenhum modelo com generateContent encontrado.')
            return
        }

        // Preencher select
        modelSelect.innerHTML = models
            .map(m => `<option value="${m.id}">${m.name} (${m.id})</option>`)
            .join('')
        modelSelect.disabled = false
        btnSendPrompt.disabled = false

        // Lista visível
        modelListContainer.innerHTML = `
            <ul>
                ${models.map(m => `<li><code>${m.id}</code> — ${m.name}</li>`).join('')}
            </ul>
        `

        setStatus('success', `✅ ${models.length} modelos encontrados. Selecione um e clique em "Enviar".`)
    } catch (err) {
        setButtonsLoading(false)
        if (err instanceof AiApiError) {
            setStatus('error', `❌ ${err.message}`)
        } else if (err instanceof Error) {
            setStatus('error', `❌ ${err.message}`)
        } else {
            setStatus('error', '❌ Erro desconhecido ao listar modelos')
        }
    }
}

btnListModels.addEventListener('click', fetchAndPopulateModels)

// ------ Enviar Prompt ------

btnSendPrompt.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim()
    const model = modelSelect.value

    if (!key) {
        setStatus('error', 'Informe uma API Key primeiro.')
        return
    }

    if (!model) {
        setStatus('error', 'Selecione um modelo primeiro.')
        return
    }

    setButtonsLoading(true)
    clearStatus()
    promptResult.textContent = '⏳ Aguardando resposta...'

    try {
        const result = await generateText(
            'Me responda em português: "Gaveta de Bagunça funcionando perfeitamente! 🎉"',
            key,
            model,
            { temperature: 0.7 }
        )

        promptResult.textContent = result.text
        setStatus('success', `✅ Resposta recebida de "${model}"`)
    } catch (err) {
        promptResult.textContent = ''
        if (err instanceof AiApiError) {
            setStatus('error', `❌ ${err.message}`)
        } else if (err instanceof Error) {
            setStatus('error', `❌ ${err.message}`)
        } else {
            setStatus('error', '❌ Erro desconhecido')
        }
    } finally {
        setButtonsLoading(false)
    }
})

// ------ Inicialização ------

// Carregar key salva (evitar recarregar)
const savedKey = sessionStorage.getItem('gemini_test_key')
if (savedKey) {
    apiKeyInput.value = savedKey
}

apiKeyInput.addEventListener('input', () => {
    sessionStorage.setItem('gemini_test_key', apiKeyInput.value.trim())
})