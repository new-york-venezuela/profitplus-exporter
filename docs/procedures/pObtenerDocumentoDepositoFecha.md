# SP: pObtenerDocumentoDepositoFecha
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)
- [`saCaja`](../tables/saCaja.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pObtenerDocumentoDepositoFecha
*DESCRIPCION	:	Obtiene una lista de documentos usados para deposito bancario
*AUTOR			:	SOFTECH SISTEMAS.
*FECHA CREADO	:	2009-10-14
*FECHA MODIFICADO:  2019-12-02
**********************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerDocumentoDepositoFecha] ( @sCodCaja VARCHAR(6) , @dtFechaDesde SMALLDATETIME = NULL ,  @dtFechaHasta SMALLDATETIME = NULL )
AS 
    BEGIN

		SET @dtFechaDesde = dbo.FechaSimple(@dtFechaDesde)
        SET @dtFechaHasta = dbo.FechaSimple(@dtFechaHasta)

        SELECT
            c.cod_caja Codigo, c.descrip Descrip, mc.forma_pag Forma_Pag, ISNULL(mc.num_pago, '') Doc_Num,
            ISNULL(mc.descrip, '') Descripcion, ( mc.monto_h + mc.monto_d ) Monto, mc.mov_num Mov_Afec,
            CASE WHEN mc.forma_pag = 'TJ' THEN
                        ISNULL(tc.comision, 0)
                  WHEN mc.forma_pag = 'CT' THEN
                        ISNULL(va.comision, 0)
                  ELSE 0.00  
                  END   comision, 
                  CASE WHEN  mc.forma_pag = 'TJ' THEN
                        ISNULL(tc.impuesto, 0) 
                  WHEN mc.forma_pag = 'CT' THEN
                        ISNULL(va.impuesto, 0)
                  ELSE 0.00
                  END   impuesto,  ISNULL(tc.recargo, 0) recargo,
            ISNULL(mc.tasa, 1) tasa, sc.co_mone AS moneda, ISNULL(mc.co_ban, '') co_ban, ISNULL(tc.co_tar, '') co_tar,
                  ISNULL(va.co_vale, '') co_vale, mc.fecha_che,
			CASE WHEN mc.forma_pag = 'TJ' THEN
                        (((mc.monto_h + mc.monto_d) * ISNULL(tc.comision, 0))/100)
                  WHEN mc.forma_pag = 'CT' THEN
                        (((mc.monto_h + mc.monto_d) * ISNULL(va.comision, 0))/100)
                  ELSE 0.00  
                  END   valor_comision, 
                  CASE WHEN  mc.forma_pag = 'TJ' THEN
                        dbo.CalcularImpuestoTarjetas(mc.mov_num, (mc.monto_h + mc.monto_d), ISNULL(tc.impuesto, 0)) 
                  WHEN mc.forma_pag = 'CT' THEN
                        dbo.CalcularImpuestoTarjetas(mc.mov_num, (mc.monto_h + mc.monto_d), ISNULL(va.impuesto, 0))
                  ELSE 0.00
                  END valor_impuesto, mc.fecha
        FROM
            saCaja c
            INNER JOIN saMovimientoCaja mc ON c.cod
```
