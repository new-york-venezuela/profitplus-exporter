# SP: pValidarInventarioFisicoAlmacen
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saInventarioFisico`](../tables/saInventarioFisico.md)
- [`saResInventario`](../tables/saResInventario.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			: [pValidarInventarioFisicoAlmacen]
*DESCRIPCIÓN	: verifica si existe o no inventarios sin procesar para un almacen determinado
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-05-21
*************************************************************************************************/

CREATE PROCEDURE [dbo].[pValidarInventarioFisicoAlmacen]
    (
      @sCo_Alma CHAR(6) ,
      @sCo_InvFisico CHAR(20) = NULL ,
      @sdFecha SMALLDATETIME = NULL,
      @bProcesado BIT
    )
AS 
    BEGIN	
        DECLARE @bPermiteDocumentosConFechaMenorUltimoInventario BIT
	
        SELECT
            @bPermiteDocumentosConFechaMenorUltimoInventario = I_permitir_fec_menor_ult_inv
        FROM
            par_emp
	
        --IF @bPermiteDocumentosConFechaMenorUltimoInventario = 0 
        --    BEGIN
                SELECT TOP 1
                    CASE WHEN IV.co_alma is null THEN RI.co_alma
						ELSE IV.co_alma
					END AS co_alma
                FROM
                    saInventarioFisico IV 
                LEFT JOIN saResInventario RI ON IV.co_invfisico = RI.co_invfisico
                WHERE
                    (((IV.co_alma = @sCo_Alma OR (IV.co_alma IS NULL AND RI.co_alma = @sCo_Alma)) AND @bProcesado = 1) OR 
                     (IV.co_alma = @sCo_Alma OR (IV.co_alma IS NULL  AND @bProcesado = 0)))
     --               AND ( @sdFecha <= inicio
     --                     OR @sdFecha IS NULL
     --                   )
					--AND (procesado = 0  OR (@bPermiteDocumentosConFechaMenorUltimoInventario=0 and procesado = 1))
     --             --  AND ( procesado = 0 ) -- Validacion en documentos solo importa abiertos
     --               AND ( co_invfisico <> @sCo_InvFisico
     --                     OR @sCo_InvFisico IS NULL
     --                   )
                     AND ( ((@sdFecha < inicio OR @sdFecha IS NULL) AND procesado = 0 AND @bProcesado = 0)
							OR ((@sdFecha < cierre OR @sdFecha IS NULL)  AND @bPermiteDocumentosConFechaMenorUltimoInventario=0 AND procesado = 1 AND @bProcesado = 1)
						)
                     AND ( IV.co_invfisico <> @sCo_InvFisico
                          OR @sCo_InvFisico IS NULL
                        )
                ORDER BY
                    inicio DESC
            --END
    END
```
