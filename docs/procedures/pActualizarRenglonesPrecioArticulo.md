# SP: pActualizarRenglonesPrecioArticulo
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarRenglonesPrecioArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarRenglonesPrecioArticulo]
    (
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sDesc_fijo VARCHAR(60) = NULL ,
      @sCo_Art CHAR(30) ,
      @sCo_ArtOri CHAR(30) ,
      @sCo_Precio CHAR(6) ,
      @sCo_PrecioOri CHAR(6) ,
      @dDesde DATETIME ,
      @dDesdeOri DATETIME ,
      @sCo_Alma CHAR(6) ,
      @sCo_AlmaOri CHAR(6) ,
      @sCo_Alma_CalculadoOri CHAR(6) ,
      @dhasta DATETIME = NULL ,
      @deMonto DECIMAL(18, 5) ,
      @bprecioOm BIT ,
      @bprecioOmOri BIT ,
      @sco_mone CHAR(6) ,
      @binactivo BIT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
	 
    )
AS 
    BEGIN  
	
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	
        IF @sCo_Alma = 'TODOS'
            OR @sCo_Alma = '' 
            BEGIN
                SET @sCo_Alma = NULL 
            END


        UPDATE
            saArtPrecio
        SET co_art = @sCo_Art, co_precio = @sCo_Precio, desde = @dDesde, co_alma = @sCo_Alma, hasta = @dHasta, Inactivo = @bInactivo,
            monto = @deMonto, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND co_precio = @sCo_PrecioOri
            AND co_alma_calculado = @sCo_Alma_CalculadoOri
            AND desde = @dDesdeOri
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
	
        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo,
```
