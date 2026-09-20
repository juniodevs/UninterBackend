import sys
import json
import time
import urllib.request
import urllib.error

BASE_URL = "http://localhost:3000"

results = []

def make_request(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data_bytes = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)

    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            elapsed_ms = int((time.time() - start_time) * 1000)
            status_code = response.status
            raw_body = response.read().decode("utf-8")
            try:
                parsed_body = json.loads(raw_body)
            except Exception:
                parsed_body = raw_body
            return status_code, parsed_body, elapsed_ms
    except urllib.error.HTTPError as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        raw_body = e.read().decode("utf-8")
        try:
            parsed_body = json.loads(raw_body)
        except Exception:
            parsed_body = raw_body
        return e.code, parsed_body, elapsed_ms
    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        return 0, str(e), elapsed_ms

def run_test(test_id, category, method, path, expected_status, body=None, token=None, check_fn=None):
    status, resp, elapsed = make_request(method, path, body, token)
    
    passed_status = (status == expected_status)
    passed_check = True
    check_msg = ""
    
    if check_fn:
        try:
            passed_check, check_msg = check_fn(resp)
        except Exception as err:
            passed_check = False
            check_msg = f"Erro na validacao: {err}"

    passed = passed_status and passed_check
    
    res_entry = {
        "id": test_id,
        "category": category,
        "method": method,
        "path": path,
        "expected": expected_status,
        "actual": status,
        "elapsed": elapsed,
        "passed": passed,
        "check_msg": check_msg,
        "response": resp
    }
    results.append(res_entry)

    tag = "[PASS]" if passed else "[FAIL]"
    time_fmt = f"{elapsed}ms".rjust(6)
    print(f" {tag:<6} {test_id:<5} {category:<22} | {method:<6} {path:<36} | Exp: {expected_status} Obt: {status} ({time_fmt})")
    
    if not passed:
        print(f"        --> FALHA: Esperado status {expected_status}, mas obteve {status}. {check_msg}")
        resp_str = json.dumps(resp, ensure_ascii=False) if isinstance(resp, (dict, list)) else str(resp)
        print(f"        --> Resposta da API: {resp_str[:180]}")

    return resp

def main():
    print("\n" + "="*85)
    print(" BATERIA DE TESTES AUTOMATIZADOS - API REDE RAIZES DO NORDESTE")
    print(f" Alvo: {BASE_URL}")
    print("="*85 + "\n")

    print("--- 1. INFRAESTRUTURA E DOCUMENTACAO ---")
    run_test("INF01", "Infraestrutura", "GET", "/", 200, check_fn=lambda r: (r.get("status") == "online", "status online"))
    run_test("INF02", "Swagger UI", "GET", "/docs/", 200)
    run_test("INF03", "Health Check", "GET", "/api/health", 200, check_fn=lambda r: (r.get("status") == "UP", "status UP"))

    print("\n--- 2. AUTENTICACAO, PERFIS E LGPD ---")
    novo_email = f"automacao.{int(time.time())}@teste.com"
    res_cad = run_test("AUT01", "Cadastro com LGPD", "POST", "/api/auth/cadastro", 201, 
                       body={"nome": "Cliente Automacao", "email": novo_email, "senha": "Senha@123", "consentimentoLgpd": True},
                       check_fn=lambda r: ("accessToken" in r, "token JWT emitido"))

    login_cli = run_test("AUT02", "Login Cliente", "POST", "/api/auth/login", 200,
                         body={"email": "maria.cliente@exemplo.com", "senha": "Senha@123"},
                         check_fn=lambda r: ("accessToken" in r and r.get("user", {}).get("perfil") == "CLIENTE", "perfil CLIENTE"))
    token_cliente = login_cli.get("accessToken") if isinstance(login_cli, dict) else None

    login_ger = run_test("AUT03", "Login Gerente", "POST", "/api/auth/login", 200,
                         body={"email": "joao.gerente@raizesdonordeste.com.br", "senha": "Senha@123"},
                         check_fn=lambda r: ("accessToken" in r and r.get("user", {}).get("perfil") == "GERENTE", "perfil GERENTE"))
    token_gerente = login_ger.get("accessToken") if isinstance(login_ger, dict) else None

    login_adm = run_test("AUT04", "Login Admin", "POST", "/api/auth/login", 200,
                         body={"email": "francisca@raizesdonordeste.com.br", "senha": "Senha@123"},
                         check_fn=lambda r: ("accessToken" in r and r.get("user", {}).get("perfil") == "ADMIN", "perfil ADMIN"))
    token_admin = login_adm.get("accessToken") if isinstance(login_adm, dict) else None

    run_test("AUT05", "Login Senha Errada", "POST", "/api/auth/login", 401,
             body={"email": "maria.cliente@exemplo.com", "senha": "SENHA_INCORRETA"},
             check_fn=lambda r: (r.get("error") == "CREDENCIAIS_INVALIDAS", "erro CREDENCIAIS_INVALIDAS"))

    run_test("AUT06", "Perfil com Token", "GET", "/api/auth/perfil", 200, token=token_cliente,
             check_fn=lambda r: (r.get("perfil") == "CLIENTE", "perfil CLIENTE confirmado"))

    run_test("AUT07", "Perfil sem Token", "GET", "/api/auth/perfil", 401)

    print("\n--- 3. UNIDADES E CARDAPIO POR FILIAL ---")
    run_test("UNI01", "Listar Unidades", "GET", "/api/unidades", 200,
             check_fn=lambda r: (isinstance(r, list) and len(r) >= 2, "ao menos 2 filiais retornadas"))

    run_test("UNI02", "Cardapio Loja 1", "GET", "/api/unidades/1/cardapio", 200,
             check_fn=lambda r: ("cardapio" in r and isinstance(r["cardapio"], list), "itens do cardapio retornados"))

    run_test("UNI03", "Cardapio Loja 9999", "GET", "/api/unidades/9999/cardapio", 404)

    print("\n--- 4. ESTOQUE E PERMISSOES DE ACESSO ---")
    run_test("EST01", "Consultar Estoque", "GET", "/api/estoque/1", 200,
             check_fn=lambda r: (isinstance(r, list) and len(r) > 0, "lista de produtos com saldo"))

    run_test("EST02", "Cliente Move Estoque", "POST", "/api/estoque/movimentar", 403,
             body={"unidadeId": 1, "produtoId": 1, "quantidade": 5, "tipo": "ENTRADA"},
             token=token_cliente)

    run_test("EST03", "Move sem Token", "POST", "/api/estoque/movimentar", 401,
             body={"unidadeId": 1, "produtoId": 1, "quantidade": 5, "tipo": "ENTRADA"})

    run_test("EST04", "Gerente Move Estoque", "POST", "/api/estoque/movimentar", 200,
             body={"unidadeId": 1, "produtoId": 1, "quantidade": 10, "tipo": "ENTRADA", "motivo": "Reposicao de teste"},
             token=token_gerente,
             check_fn=lambda r: ("saldoAtual" in r, "saldo atualizado"))

    print("\n--- 5. PEDIDOS MULTICANAL E REGRAS DE NEGOCIO ---")
    res_totem = run_test("PED01", "Pedido Canal TOTEM", "POST", "/api/pedidos", 201,
                         body={
                             "unidadeId": 1,
                             "canalPedido": "TOTEM",
                             "clienteId": 2,
                             "itens": [{"produtoId": 1, "quantidade": 2}]
                         },
                         token=token_cliente,
                         check_fn=lambda r: (r.get("canalPedido") == "TOTEM", "canal TOTEM validado"))
    ultimo_pedido_id = res_totem.get("pedidoId") if isinstance(res_totem, dict) else 1

    run_test("PED02", "Pedido Canal APP", "POST", "/api/pedidos", 201,
             body={
                 "unidadeId": 1,
                 "canalPedido": "APP",
                 "itens": [{"produtoId": 2, "quantidade": 1}]
             },
             token=token_cliente,
             check_fn=lambda r: (r.get("canalPedido") == "APP", "canal APP validado"))

    run_test("PED03", "Pedido Canal BALCAO", "POST", "/api/pedidos", 201,
             body={
                 "unidadeId": 2,
                 "canalPedido": "BALCAO",
                 "clienteId": 2,
                 "itens": [{"produtoId": 3, "quantidade": 1}]
             },
             check_fn=lambda r: (r.get("canalPedido") == "BALCAO", "canal BALCAO validado"))

    run_test("PED04", "Canal Omitido", "POST", "/api/pedidos", 422,
             body={
                 "unidadeId": 1,
                 "itens": [{"produtoId": 1, "quantidade": 1}]
             },
             token=token_cliente)

    run_test("PED05", "Canal Invalido", "POST", "/api/pedidos", 422,
             body={
                 "unidadeId": 1,
                 "canalPedido": "DRIVE_THRU",
                 "itens": [{"produtoId": 1, "quantidade": 1}]
             },
             token=token_cliente)

    run_test("PED06", "Estoque Insuficiente", "POST", "/api/pedidos", 409,
             body={
                 "unidadeId": 1,
                 "canalPedido": "APP",
                 "clienteId": 2,
                 "itens": [{"produtoId": 1, "quantidade": 99999}]
             },
             token=token_cliente,
             check_fn=lambda r: (r.get("error") == "ESTOQUE_INSUFICIENTE", "erro ESTOQUE_INSUFICIENTE"))

    run_test("PED07", "Listar Pedidos", "GET", "/api/pedidos", 200,
             check_fn=lambda r: ("data" in r and isinstance(r["data"], list), "lista de pedidos presente"))

    run_test("PED08", "Filtro Canal TOTEM", "GET", "/api/pedidos?canalPedido=TOTEM", 200,
             check_fn=lambda r: (all(p.get("canalPedido") == "TOTEM" for p in r.get("data", [])), "todos pedidos TOTEM"))

    run_test("PED09", "Buscar Pedido ID", "GET", f"/api/pedidos/{ultimo_pedido_id}", 200,
             check_fn=lambda r: (r.get("pedidoId") == ultimo_pedido_id, "id do pedido correto"))

    run_test("PED10", "Buscar Pedido 99999", "GET", "/api/pedidos/99999", 404)

    print("\n--- 6. INTEGRACAO COM GATEWAY MOCK ---")
    run_test("PAG01", "Pagamento Aprovado", "POST", "/api/pagamentos/mock/processar", 200,
             body={
                 "pedidoId": ultimo_pedido_id,
                 "metodo": "PIX",
                 "simulacaoStatus": "APROVADO"
             },
             token=token_cliente,
             check_fn=lambda r: (r.get("novoStatusPedido") == "PREPARANDO", "status mudou para PREPARANDO"))

    res_recusa = make_request("POST", "/api/pedidos", body={
        "unidadeId": 1,
        "canalPedido": "APP",
        "clienteId": 2,
        "itens": [{"produtoId": 2, "quantidade": 1}]
    }, token=token_cliente)
    ped_recusa_id = res_recusa[1].get("pedidoId") if res_recusa[0] == 201 else 1

    run_test("PAG02", "Pagamento Recusado", "POST", "/api/pagamentos/mock/processar", 402,
             body={
                 "pedidoId": ped_recusa_id,
                 "metodo": "CARTAO_CREDITO",
                 "simulacaoStatus": "RECUSADO"
             },
             token=token_cliente,
             check_fn=lambda r: (r.get("error") == "PAGAMENTO_RECUSADO", "erro PAGAMENTO_RECUSADO"))

    print("\n--- 7. ATUALIZACAO DE STATUS E PERMISSOES ---")
    run_test("STA01", "Cliente Altera Status", "PATCH", f"/api/pedidos/{ultimo_pedido_id}/status", 403,
             body={"status": "PRONTO"},
             token=token_cliente)

    run_test("STA02", "Gerente Status PRONTO", "PATCH", f"/api/pedidos/{ultimo_pedido_id}/status", 200,
             body={"status": "PRONTO"},
             token=token_gerente,
             check_fn=lambda r: (r.get("novoStatus") == "PRONTO", "status atualizado para PRONTO"))

    run_test("STA03", "Gerente Status ENTREGUE", "PATCH", f"/api/pedidos/{ultimo_pedido_id}/status", 200,
             body={"status": "ENTREGUE"},
             token=token_gerente,
             check_fn=lambda r: (r.get("novoStatus") == "ENTREGUE", "status final ENTREGUE"))

    run_test("STA04", "Status Inexistente", "PATCH", f"/api/pedidos/{ultimo_pedido_id}/status", 422,
             body={"status": "STATUS_INEXISTENTE"},
             token=token_gerente)

    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])
    failed_count = total - passed_count
    taxa = (passed_count / total) * 100 if total > 0 else 0

    print("\n" + "="*85)
    print(" RELATORIO CONSOLIDADO DA SUITE DE TESTES")
    print("="*85)
    print(f" Total de Requisicoes / Endpoints Testados: {total}")
    print(f" Sucessos: {passed_count}")
    print(f" Falhas:   {failed_count}")
    print(f" Taxa de Aprovacao: {taxa:.1f}%")
    print("="*85 + "\n")

    if failed_count > 0:
        sys.exit(1)
    else:
        print(">> SUCESSO ABSOLUTO: 100% DOS TESTES DA API PASSARAM COM EXITO!")
        sys.exit(0)

if __name__ == "__main__":
    main()
