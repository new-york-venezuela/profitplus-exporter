# SP: pSeleccionarRenglonesPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCheque`](../tables/saCheque.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraInfoIGTF`](../tables/saDocumentoCompraInfoIGTF.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)
- [`saPagoRetenIvaReng`](../tables/saPagoRetenIvaReng.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArticulo
DESCRIPCION: Selecciona un pago
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS

MODIFICADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesPago] ( @sCob_Num CHAR(20) )
AS 
    BEGIN
	
        DECLARE @bValidaPagar AS BIT

        SET @bValidaPagar = ( SELECT TOP ( 1 )
                                Cb_Canc_Comp_Ord_Pag
                              FROM
                                par_emp
                            )
	
	/*PRIMERA LISTA DE RENGLONES ASOCIADOS AL pago*/

        SELECT
            pd.*, dc.co_mone, dc.fec_emis, dc.fec_venc, dc.saldo AS Saldo_Pend, dc.total_neto AS Neto, dc.n_control,
            dc.monto_imp AS Monto_Imp, dc.validador AS validadorDoc, dc.tasa AS tasaDocumento, p.tasa AS tasa, p.fecha AS Fecha_Pago,
            CAST(( CASE @bValidaPagar
                     WHEN 0 THEN td.act_prog_pago
                     WHEN 1 THEN dc.pagar
                   END ) AS BIT) AS autorizado,
		--Selecciono el signo segun el tipo de movimiento
            ( CASE td.tipo_mov
                WHEN 'DE' THEN '+'
                ELSE '-'
              END ) AS signoVsTipo,
		--Identifico si exiten renglones de retencion asociados a un documento
            CAST(( CASE WHEN ( ( SELECT
                                    COUNT(pr.reng_num)
                                 FROM
                                    saPagoRentenReng pr
                                 WHERE
                                    pr.rowguid_reng_cob IN ( SELECT
                                                                pd1.rowguid
                                                             FROM
                                                                saPagoDocReng pd1
                                                             WHERE
                                                                pd1.rowguid_reng_ori = pd.rowguid
                                                                AND pd1.co_tipo_doc = 'ISLR' )
                               ) > 0
                               AND pd.co_tipo_doc <> 'ISLR'
                             ) THEN 1
```
