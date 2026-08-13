# SP: RepMargenDeGananciaPorArticulo2
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <21/02/2011>
-- Description:	<Reporte de Total de Ventas por Artículo2>
-- =============================================
CREATE PROCEDURE [dbo].[RepMargenDeGananciaPorArticulo2]
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @dCo_fecha_d DATETIME = NULL ,
    @dCo_fecha_h DATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCriterio CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Trans_d CHAR(6) = NULL ,
    @sCo_Trans_h CHAR(6) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @iTasa INT = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_Sub_Linea_d CHAR(6) = NULL ,
    @sCo_Sub_Linea_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)
	   
        IF @sCriterio IS NULL 
            SET @sCriterio = '1'
	
        IF ( @ITasa IS NULL
             OR @ITasa = 0.00
           )
            AND ( @sCriterio = '3'
                  OR @sCriterio = '4'
                ) 
            BEGIN
                RAISERROR('Debe Colocar Una Tasa Cuando Seleccione Opciones OM',16,1)
                RETURN
            END 
	   
        DECLARE @c_margen_costo_precio BIT
        SET @c_margen_costo_precio = ( SELECT
                                        c_margen_costo_precio
                                       FROM
                                        par_emp
                                     )

		DECLARE @Moneda_parametro CHAR(6)
		SET @Moneda_parametro = null-- ( SELECT g_moneda FROM par_emp) DN comentado para mostrar todo en Bs
	   
        SELECT
            'FACT' AS tipo, 'criterio' = @sCriterio, A.co_art, A.art_des, FR.doc_num, '' AS doc_orig, FR.co_alma,
            FR.total_art, FR.total_dev, 
		--FR.otros,  
            ISNULL(ROUND(( ( FR.prec_vta - FR.monto_desc - FR.monto_desc_glob + FR.monto_reca_glob ) + FR.otros ) , 2),
                   0.00) AS monto_base,
            CASE WHEN @sCriterio = '7'
                 THEN R
```
