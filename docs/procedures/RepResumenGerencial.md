# SP: RepResumenGerencial
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saBanco`](../tables/saBanco.md)
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepResumenGerencial
DESCRIPCION: Reporte Resumen Gerencial
CREADO POR: SOFTECH SISTEMAS
LAST DATE:2017-06-27
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepResumenGerencial]
    (
      @dfecha DATETIME = NULL ,
      @sTipoCosto CHAR(10) = NULL ,
      @sNivelStock CHAR(10) = NULL ,
      @Itasa INT = 0.00 ,
      @sIncluirOrden CHAR(2) = NULL ,
      @sIncluiInventario CHAR(2) = NULL ,
	  @bHeaderRep BIT = 0
    )
AS 
    BEGIN
	
	SET NOCOUNT ON;
	
		Declare @MonedaBase char(6)
		Select @MonedaBase = g_moneda from par_emp


        IF @dfecha IS NULL 
            SET @dfecha = dbo.FechaSimple(@dfecha)

        IF @sNivelStock IS NULL 
            SET @sNivelStock = 'DIFE' 

        IF @sTipoCosto IS NULL 
            SET @sTipoCosto = '1'

        IF ( @ITasa IS NULL
             OR @ITasa = 0.00
           )
            AND ( @sTipoCosto = '3'
                  OR @sTipoCosto = '4'
                ) 
            BEGIN
                RAISERROR('Debe Colocar Una Tasa Cuando Seleccione Opciones OM',16,1)
                RETURN
            END


        SELECT
            CASE WHEN @sIncluirOrden = 'SI' THEN 'SI'
                 ELSE 'NO'
            END AS IncluirOrden, CASE WHEN @sIncluiInventario = 'SI' THEN 'SI'
                                      ELSE 'NO'
                                 END AS IncluirInventario, saldoCaja, 
			saldoCajaOM, OM as Caja_om, saldoBanco, 
			saldoBancoOM, OMB as Banco_OM, saldoCXC,
            saldoCXP, inventario, OrdenPago, ImpValorAgregado
        FROM
            ( SELECT
                ISNULL(SUM(( monto_h - monto_d ) * tasa_fec),0.00) AS saldoCaja,
				isnull(SUM(monto_hOM -monto_dOM),0.00) AS OM  
              FROM
                ( SELECT
					CASE WHEN [dbo].[ObtenerMonedaBase]() = CA.co_mone THEN 0.00
                         ELSE ROUND(SUM(MC.monto_h), 2)
                    END AS monto_hOM,
					CASE WHEN [dbo].[ObtenerMonedaBase]() = CA.co_mone THEN 0.00
                                           ELSE ROUND(SUM(MC.monto_d), 2)
                    END AS monto_dOM,
                    CASE WHEN [dbo].[ObtenerMonedaBase]() = CA.co_mone
                         THEN ROUND(SUM(MC.monto_h) * ISNULL(dbo.TasaAUnaFecha(CA.co_mone, 0,
```
