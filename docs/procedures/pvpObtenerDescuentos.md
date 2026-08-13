# SP: pvpObtenerDescuentos
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDescArticulo`](../tables/saDescArticulo.md)
- [`saDescCategoria`](../tables/saDescCategoria.md)
- [`saDescLinea`](../tables/saDescLinea.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pvpObtenerDescuentos
*AUTOR			:		SOFTECH SISTEMAS
*DESCRIPCIÓN	:		Obtiene todos los descuentos (Por articulo, Por Linea y por Categoria)
************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpObtenerDescuentos]
    (
      @deCantidad DECIMAL(18, 5) ,
      @sTipoCliente CHAR(6) ,
      @sCoArticulo CHAR(30) ,
      @sCoLinea CHAR(6) = NULL ,
      @sCoCategoria CHAR(6) = NULL,
	  @sCoUnidad CHAR(30) =NULL,
      @dFecha SMALLDATETIME
    )
AS 
    BEGIN

        DECLARE @DescuentoArt DECIMAL(18, 2)
        DECLARE @DescuentoLin DECIMAL(18, 2)
        DECLARE @DescuentoCat DECIMAL(18, 2)

		if @sCoLinea is null
			begin
				select @sCoLinea = co_lin
				from saArticulo
				where co_art=@sCoArticulo
			end
			
		if @sCoCategoria is null
			begin
				select @sCoCategoria = co_cat
				from saArticulo
				where co_art=@sCoArticulo
			end

		if (@sCoUnidad is not null and @sCoUnidad <> '')
		Begin
			set @deCantidad = [dbo].[ArtUnidadBase](@sCoArticulo,@sCoUnidad,@deCantidad)
		end
--DESCUENTO POR ARTICULO
----------------------------------------------------
----------------------------------------------------
        SELECT
            @DescuentoArt = CASE WHEN ( @deCantidad <= hasta1 ) THEN porc1
                                 WHEN ( @deCantidad <= hasta2
                                        AND @deCantidad > hasta1
                                      ) THEN porc2
                                 WHEN ( @deCantidad <= hasta3
                                        AND @deCantidad > hasta2
                                      ) THEN porc3
                                 WHEN ( @deCantidad <= hasta4
                                        AND @deCantidad > hasta3
                                      ) THEN porc4
                                 WHEN ( @deCantidad <= hasta5
                                        AND @deCantidad > hasta4
                                      ) THEN porc5
                            END
        FROM
            saDescArticulo
        WHERE
            tip_cli = @sTipoCliente
            AND co_art = @sCoArticulo
			AND (dbo.FechaSimple(@dFecha) BETWEEN dbo.FechaSimple(Fecha_Ini) AND dbo.FechaSimple(Fecha_Fin))

--DESCUENTO POR LINEA
-------------------------------------------
```
