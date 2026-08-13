# SP: pSeleccionarRenglonesCobro
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCheque`](../tables/saCheque.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroRentenReng`](../tables/saCobroRentenReng.md)
- [`saCobroRetenIvaReng`](../tables/saCobroRetenIvaReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCobro
DESCRIPCION: Selecciona un Cobro
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesCobro] ( @sCob_Num CHAR(20) )
AS 
    BEGIN

	
        DECLARE @bValidaPagar AS BIT

        SET @bValidaPagar = ( SELECT TOP ( 1 )
                                Cb_Canc_Comp_Ord_Pag
                              FROM
                                par_emp
                            )
	
		--PRIMERA LISTA DE RENGLONES ASOCIADOS AL COBRO

        SELECT
            pd.*, dc.co_mone, dc.fec_emis, dc.fec_venc, dc.saldo AS Saldo_Pend, dc.total_neto AS Neto,
            dc.validador AS validadorDoc, dc.tasa AS tasaDocumento, c.tasa AS tasa,
		--Selecciono el signo segun el tipo de movimiento
            ( CASE td.tipo_mov
                WHEN 'DE' THEN '+'
                ELSE '-'
              END ) AS signoVsTipo,
		--Identifico si exiten renglones de retencion asociados a un documento
            CAST(( CASE WHEN ( ( SELECT
                                    COUNT(pr.reng_num)
                                 FROM
                                    saCobroRentenReng pr
                                 WHERE
                                    pr.rowguid_reng_cob IN ( SELECT
                                                                pd1.rowguid
                                                             FROM
                                                                saCobroDocReng pd1
                                                             WHERE
                                                                pd1.rowguid_reng_ori = pd.rowguid
                                                                AND pd1.co_tipo_doc = 'ISLR' )
                               ) > 0
                               AND pd.co_tipo_doc <> 'ISLR'
                             ) THEN 1

						--RETENCIÓN GLOBAL
						WHEN ( (SELECT COUNT(pr.reng_num) FROM saCobroRentenReng pr WHERE pr.rowguid_reng_cob IN 
						( SELECT pd1.rowguid FROM saCobroDocReng pd1 WHERE pd1.rowguid = pd.rowguid_reng_ori AND pd1.co_tipo_doc = 'ISLR' )) 
						> 0 AND pd.co_tipo_doc <> 'ISLR') THEN 1

                        ELSE 0
```
